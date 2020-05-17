import * as AWS from 'aws-sdk'
import { GetItemOutput, UpdateItemOutput } from 'aws-sdk/clients/dynamodb'

import { Poll } from './domain'

const VOTES_TABLE_NAME = process.env.VOTES_TABLE_NAME || 'MISSING_TABLE_NAME'
const OAUTH_TABLE_NAME = process.env.OAUTH_TABLE_NAME || 'MISSING_TABLE_NAME'

const db = new AWS.DynamoDB.DocumentClient()

export const storeCredentials = (teamId: string, accessToken: string) => {
  const param = {
    TableName: OAUTH_TABLE_NAME,
    Item: {
      teamId,
      accessToken,
    },
  }
  return db.put(param).promise()
}

export const getCredentials = (teamId: string) => {
  const param = {
    TableName: OAUTH_TABLE_NAME,
    Key: {
      teamId: teamId,
    },
  }
  return db
    .get(param)
    .promise()
    .then((data: GetItemOutput) => {
      if (data.Item) {
        return data.Item.accessToken
      } else {
        console.log('ERROR: No token for ', teamId)
        return null
      }
    })
}

export const persistPoll = (newPoll: Poll) => {
  const param = {
    TableName: VOTES_TABLE_NAME,
    Item: {
      ...newPoll,
    },
  }
  return db.put(param).promise()
}

export const getPoll = (id: string): Promise<Poll | null> => {
  const param = {
    TableName: VOTES_TABLE_NAME,
    Key: {
      id: id,
    },
  }
  return db
    .get(param)
    .promise()
    .then((data: GetItemOutput) => {
      if (data.Item) {
        return dynamoToPoll(data.Item)
      } else {
        return null
      }
    })
}

export const setPollOpenness = (id: string, mode: boolean) => {
  return db
    .update({
      TableName: VOTES_TABLE_NAME,
      Key: { id: id },
      ReturnValues: 'ALL_NEW',
      UpdateExpression: 'SET isOpen = :MODE',
      ExpressionAttributeValues: {
        ':MODE': mode,
      },
    })
    .promise()
    .then((data: UpdateItemOutput) => dynamoToPoll(data.Attributes))
    .catch((err) => {
      if (err.name !== 'ConditionalCheckFailedException') console.log(err)
    })
}

export const setPollToLimitedVote = (id: string, voteType: string, limit = null) => {
  return db
    .update({
      TableName: VOTES_TABLE_NAME,
      Key: { id: id },
      ReturnValues: 'ALL_NEW',
      UpdateExpression: 'SET votesLimit = :LIMIT, voteType = :VOTE_TYPE',
      ExpressionAttributeValues: {
        ':LIMIT': limit,
        ':VOTE_TYPE': voteType,
      },
    })
    .promise()
    .then((data: UpdateItemOutput) => dynamoToPoll(data.Attributes))
    .catch((err) => {
      if (err.name !== 'ConditionalCheckFailedException') console.log(err)
    })
}

export const setPollTransparency = (id: string, isAnon: boolean) => {
  return db
    .update({
      TableName: VOTES_TABLE_NAME,
      Key: { id: id },
      ReturnValues: 'ALL_NEW',
      UpdateExpression: 'SET isAnon = :IS_ANON',
      ExpressionAttributeValues: {
        ':IS_ANON': isAnon,
      },
    })
    .promise()
    .then((data: UpdateItemOutput) => dynamoToPoll(data.Attributes))
    .catch((err) => {
      if (err.name !== 'ConditionalCheckFailedException') console.log(err)
    })
}

export const addVotesForMany = (pollId: string, poller: string, option: number): Promise<void | Poll> => {
  return db
    .update({
      TableName: VOTES_TABLE_NAME,
      Key: { id: pollId },
      ReturnValues: 'ALL_NEW',
      UpdateExpression: 'ADD votes.#poller :OPTION',
      ConditionExpression: 'isOpen = :DESIRED_OPEN',
      ExpressionAttributeNames: {
        '#poller': poller,
      },
      ExpressionAttributeValues: {
        ':OPTION': db.createSet([option]),
        ':DESIRED_OPEN': true,
      },
    })
    .promise()
    .then((data: UpdateItemOutput) => dynamoToPoll(data.Attributes))
    .catch((err) => {
      if (err.name !== 'ConditionalCheckFailedException') console.log(err)
    })
}

export const addVotesForSingle = (pollId: string, poller: string, option: number) => {
  return db
    .update({
      TableName: VOTES_TABLE_NAME,
      Key: { id: pollId },
      ReturnValues: 'ALL_NEW',
      UpdateExpression: 'SET votes.#poller = :OPTION',
      ConditionExpression: 'isOpen = :DESIRED_OPEN',
      ExpressionAttributeNames: {
        '#poller': poller,
      },
      ExpressionAttributeValues: {
        ':OPTION': db.createSet([option]),
        ':DESIRED_OPEN': true,
      },
    })
    .promise()
    .then((data: UpdateItemOutput) => dynamoToPoll(data.Attributes))
    .catch((err) => {
      if (err.name !== 'ConditionalCheckFailedException') console.log(err)
    })
}

export const removeVote = (pollId: string, poller: string, option: number) => {
  return db
    .update({
      TableName: VOTES_TABLE_NAME,
      Key: { id: pollId },
      ReturnValues: 'ALL_NEW',
      UpdateExpression: 'DELETE votes.#poller :OPTION',
      ConditionExpression: 'isOpen = :DESIRED_OPEN',
      ExpressionAttributeNames: {
        '#poller': poller,
      },
      ExpressionAttributeValues: {
        ':OPTION': db.createSet([option]),
        ':DESIRED_OPEN': true,
      },
    })
    .promise()
    .then((data: UpdateItemOutput) => dynamoToPoll(data.Attributes))
    .catch((err) => {
      if (err.name !== 'ConditionalCheckFailedException') console.log(err)
    })
}

export const deletePoll = (pollId: string) => {
  return db
    .delete({
      TableName: VOTES_TABLE_NAME,
      Key: { id: pollId },
    })
    .promise()
}

const dynamoToPoll = (raw: any): Poll => {
  return {
    id: raw['id'],
    question: raw['question'],
    options: raw['options'],
    voteType: raw['voteType'],
    votesLimit: raw['votesLimit'],
    isAnon: raw['isAnon'],
    createdBy: raw['createdBy'],
    isOpen: raw['isOpen'],
    createdAt: raw['createdAt'],
    votes: raw['votes'],
  }
}
