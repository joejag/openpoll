import axios from 'axios'

import { WebClient } from '@slack/web-api'

import {
    addVotesForMany, addVotesForSingle, deletePoll, getCredentials, getPoll, persistPoll,
    removeVote, setPollOpenness, setPollToLimitedVote, setPollTransparency
} from './dynamoStore'
import { createDraftSlackPoll, createPollSummary, createSlackPoll } from './slack_message_templates'

export interface Votes {
  [poller: string]: number[]
}

export interface Poll {
  id: string
  question: string
  options: string[]
  voteType: 'LIMITED' | 'UNLIMITED'
  votesLimit?: number
  isAnon: boolean
  createdBy: string
  isOpen: boolean
  createdAt: string
  votes: Votes
}

export enum Interactions {
  // poll actions
  StartPoll = 'StartPoll',
  DiscardPoll = 'DiscardPoll',
  FinishPoll = 'FinishPoll',

  // vote visibility
  SetPrivateVote = 'SetPrivateVote',
  SetPublicVote = 'SetPublicVote',

  // vote count
  SetVotesUnlimited = 'SetVotesUnlimited',
  SetVotesOne = 'SetVotesOne',
  SetVotesTwo = 'SetVotesTwo',
  SetVotesThree = 'SetVotesThree',
  SetVotesFour = 'SetVotesFour',
}

// This forces quotation marks around single words, so we can parse the command easily
export const questionExtractor = (pollOptions: string): any => {
  let quotedPollOptions = ''
  const splitOnEveryCharacter = pollOptions.replace(/“/g, '"').replace(/”/g, '"').split('')

  let inQuotedString: boolean = false
  let forcedQuotedString: boolean = false
  splitOnEveryCharacter.forEach((letter: string) => {
    // outside quotedString, encounter quote => take a note
    if (letter === '"' && !inQuotedString) {
      inQuotedString = true
      quotedPollOptions += letter
    }
    // inside quotedString, encounter quote => take a note
    else if (letter === '"' && inQuotedString) {
      inQuotedString = false
      quotedPollOptions += letter
    }
    // not inside quotedString, not a space or quote => force the quote
    else if (letter !== '"' && !inQuotedString && letter !== ' ') {
      inQuotedString = true
      forcedQuotedString = true
      quotedPollOptions += '"'
      quotedPollOptions += letter
    }
    // inside forced quotedString, encounter space => end the quote
    else if (letter === ' ' && forcedQuotedString) {
      quotedPollOptions += '"'
      quotedPollOptions += letter
      inQuotedString = false
      forcedQuotedString = false
    }
    // just add the letter
    else {
      quotedPollOptions += letter
    }
  })
  if (quotedPollOptions[quotedPollOptions.length - 1] !== '"') {
    quotedPollOptions += '"'
  }

  const questionAndOptions = quotedPollOptions.split('"').filter((chunk: string) => chunk.trim().length !== 0)

  return {
    question: questionAndOptions[0],
    options: questionAndOptions.slice(1),
  }
}

const createSlackClient = (teamId: string) => {
  return getCredentials(teamId).then((creds: any) => new WebClient(creds))
}

// We get a command from Slack like '/poll "My question?" "option one" "option two"' which we create into a draft poll
export const handleSlashCommand = (id: string, question: string, options: string[], author: string, slackEvent: any): Promise<any> => {
  if (options.length < 2) {
    return createSlackClient(slackEvent.team_id).then((web) =>
      web.chat.postEphemeral({
        channel: slackEvent.channel_id,
        user: slackEvent.user_id,
        text: 'You need to have a question with at least two options. /poll “Where should we go on holiday?” “Ivory Coast” France “Cape Verde Islands”',
      })
    )
  } else {
    const newPoll: Poll = {
      id: id,
      question: question,
      options: options,
      voteType: 'UNLIMITED',
      isAnon: false,
      createdBy: author,
      isOpen: false,
      createdAt: new Date().toISOString(),
      votes: {},
    }

    return createSlackClient(slackEvent.team_id).then((web) =>
      web.chat
        .postEphemeral({ channel: slackEvent.channel_id, user: slackEvent.user_id, text: '', blocks: createDraftSlackPoll(newPoll) })
        .then((res) => {
          newPoll.id = `${slackEvent.team_id}-${slackEvent.channel_id}-${res.message_ts}`
          return persistPoll(newPoll)
        })
        .catch((error) => {
          console.error(error)
        })
    )
  }
}

// Whenever someone interacts with a Slack visual the command gets sent here
export const handleSlackInteractions = (action: string, id: string, payload: any): Promise<any> => {
  if (action === Interactions.SetVotesUnlimited) {
    return setPollToLimitedVote(id, 'UNLIMITED').then((poll: any) => {
      return axios.post(payload.response_url, { replace_original: 'true', blocks: createDraftSlackPoll(poll) })
    })
  }
  if (action === Interactions.SetVotesOne) {
    return setPollToLimitedVote(id, 'LIMITED', 1).then((poll: any) => {
      return axios.post(payload.response_url, { replace_original: 'true', blocks: createDraftSlackPoll(poll) })
    })
  }
  if (action === Interactions.SetVotesTwo) {
    return setPollToLimitedVote(id, 'LIMITED', 2).then((poll: any) => {
      return axios.post(payload.response_url, { replace_original: 'true', blocks: createDraftSlackPoll(poll) })
    })
  }
  if (action === Interactions.SetVotesThree) {
    return setPollToLimitedVote(id, 'LIMITED', 3).then((poll: any) => {
      return axios.post(payload.response_url, { replace_original: 'true', blocks: createDraftSlackPoll(poll) })
    })
  }

  if (action === Interactions.SetPublicVote) {
    return setPollTransparency(id, false).then((poll: any) => {
      return axios.post(payload.response_url, { replace_original: 'true', blocks: createDraftSlackPoll(poll) })
    })
  }
  if (action === Interactions.SetPrivateVote) {
    return setPollTransparency(id, true).then((poll: any) => {
      return axios.post(payload.response_url, { replace_original: 'true', blocks: createDraftSlackPoll(poll) })
    })
  }

  if (action === Interactions.DiscardPoll) {
    return setPollOpenness(id, false).then((poll) => {
      return axios.post(payload.response_url, { delete_original: 'true' }).then(() => deletePoll(id))
    })
  }

  if (action === Interactions.StartPoll) {
    return axios
      .post(payload.response_url, { delete_original: 'true' })
      .then(() => getPoll(id))
      .then((poll: any) => {
        return createSlackClient(payload.team.id).then((web) => {
          return web.chat
            .postMessage({ channel: payload.channel.id, text: '', blocks: createSlackPoll(poll) })
            .then((res: any) => {
              poll.id = `${payload.team.id}-${payload.channel.id}-${res.message.ts}`
              poll.isOpen = true
              return persistPoll(poll)
            })
            .then(() => deletePoll(id))
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  if (action.match('vote_[0-9]+')) {
    const choice: number = parseInt(action.split('_')[1])

    return getPoll(id).then((poll: Poll) => {
      const alreadyVotedForChoice = poll.votes[payload.user.id] && poll.votes[payload.user.id].values.includes(choice)
      let timesVoted = 0
      if (poll.votes[payload.user.id]) {
        timesVoted = poll.votes[payload.user.id].values.length
      }

      if (poll.voteType === 'UNLIMITED' && !alreadyVotedForChoice) {
        return addVotesForMany(id, payload.user.id, choice).then((poll: Poll) => {
          if (poll) {
            return axios.post(payload.response_url, { replace_original: 'true', blocks: createSlackPoll(poll) })
          } else {
            return Promise.resolve()
          }
        })
      } else if (poll.voteType === 'UNLIMITED' && alreadyVotedForChoice) {
        return removeVote(id, payload.user.id, choice).then((poll: Poll) => {
          if (poll) {
            return axios.post(payload.response_url, { replace_original: 'true', blocks: createSlackPoll(poll) })
          } else {
            return Promise.resolve()
          }
        })
      }

      if (poll.voteType === 'LIMITED' && !alreadyVotedForChoice && poll.votesLimit === 1) {
        return addVotesForSingle(id, payload.user.id, choice).then((poll: Poll) => {
          if (poll) {
            return axios.post(payload.response_url, { replace_original: 'true', blocks: createSlackPoll(poll) })
          } else {
            return Promise.resolve()
          }
        })
      } else if (poll.voteType === 'LIMITED' && !alreadyVotedForChoice && timesVoted < poll.votesLimit) {
        return addVotesForMany(id, payload.user.id, choice).then((poll: Poll) => {
          if (poll) {
            return axios.post(payload.response_url, { replace_original: 'true', blocks: createSlackPoll(poll) })
          } else {
            return Promise.resolve()
          }
        })
      } else if (poll.voteType === 'LIMITED' && alreadyVotedForChoice) {
        return removeVote(id, payload.user.id, choice).then((poll: Poll) => {
          if (poll) {
            return axios.post(payload.response_url, { replace_original: 'true', blocks: createSlackPoll(poll) })
          } else {
            return Promise.resolve()
          }
        })
      }
    })
  }

  if (action === Interactions.FinishPoll) {
    return setPollOpenness(id, false).then((poll: Poll) => {
      if (poll) {
        return axios.post(payload.response_url, { replace_original: 'true', blocks: createPollSummary(poll) }).then(() => deletePoll(poll.id))
      } else {
        return Promise.resolve()
      }
    })
  }

  return Promise.resolve()
}
