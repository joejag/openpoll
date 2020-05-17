import axios from 'axios'

import { handleSlackInteractions, handleSlashCommand, questionExtractor } from '../domain'
import { storeCredentials } from '../dynamoStore'

const qs = require('querystring')
const { parse } = require('querystring')

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || 'MISSING_CLIENT_ID'
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || 'MISSING_CLIENT_SECRET'

export const installHandler = async function () {
  const scope = `commands%2Cchat%3Awrite`
  const state = Math.random().toString(36).substring(7)

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body: `<a href=https://slack.com/oauth/v2/authorize?scope=${scope}&state=${state}&client_id=${SLACK_CLIENT_ID}>
       <img alt=""Add to Slack"" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" />
     </a>`,
  }
}

export const oauthHandler = async function (event: any) {
  console.log('request => ', JSON.stringify(event, undefined, 2))
  console.log('query', event.queryStringParameters)

  const accessCode = event.queryStringParameters.code

  let data = {
    code: accessCode,
    client_id: SLACK_CLIENT_ID,
    client_secret: SLACK_CLIENT_SECRET,
  }

  return axios
    .post('https://slack.com/api/oauth.v2.access', qs.stringify(data), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    .then((axiosRes) => {
      const appId = axiosRes.data.app_id
      const teamId = axiosRes.data.team.id
      const accessToken = axiosRes.data.access_token
      console.log({ teamId, accessToken })
      return storeCredentials(teamId, accessToken).then(() => {
        return {
          statusCode: 301,
          headers: {
            Location: `slack://app?team=${teamId}&id=${appId}`,
          },
        }
      })
    })
    .catch((err) => {
      console.log('error', err)
      return {
        statusCode: 500,
        body: 'Something has gone wrong',
      }
    })
}

export const commandHandler = async function (event: any) {
  console.log('request => ', JSON.stringify(event, undefined, 2))

  const slackEvent = parse(event.body)
  const id = `${slackEvent.team_id}-${slackEvent.channel_id}-${slackEvent.user_id}`
  const author = slackEvent.user_id
  const { question, options } = questionExtractor(slackEvent.text)
  console.log({ id, command: slackEvent.command + ' ' + slackEvent.text })

  await handleSlashCommand(id, question, options, author, slackEvent)

  return {
    statusCode: 200,
  }
}

export const interactionsHandler = async function (event: any) {
  console.log('request => ', JSON.stringify(event, undefined, 2))

  const slackEvent = parse(event.body)
  const payload = JSON.parse(slackEvent.payload)
  const id = `${payload.team.id}-${payload.channel.id}-${payload.container.message_ts}`
  const action = payload.actions[0].value
  console.log({ id, action })

  await handleSlackInteractions(action, id, payload)

  return {
    statusCode: 200,
  }
}
