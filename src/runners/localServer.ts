import * as AWS from 'aws-sdk'
import axios from 'axios'

import { handleSlackInteractions, handleSlashCommand, questionExtractor } from '../domain'
import { storeCredentials } from '../dynamoStore'

import qs = require('querystring')
import bodyParser = require('body-parser')
import express = require('express')

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || 'MISSING_CLIENT_ID'
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || 'MISSING_CLIENT_SECRET'
AWS.config.update({ region: 'eu-west-2' }) // for Dynamo DB - AWS sets this automatically

const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.listen(4390, () => {
  console.log('Example app listening on port ' + 4390)
})

app.get('/install', async (req, res) => {
  const scope = `commands%2Cchat%3Awrite`
  res.send(
    `<a href=https://slack.com/oauth/v2/authorize?scope=${scope}&state=something&client_id=${SLACK_CLIENT_ID}>
       <img alt=""Add to Slack"" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" />
     </a>`
  )
})

app.get('/oauth', async (req, res) => {
  const accessCode = req.query.code

  let data = {
    code: accessCode,
    client_id: SLACK_CLIENT_ID,
    client_secret: SLACK_CLIENT_SECRET,
  }

  axios
    .post('https://slack.com/api/oauth.v2.access', qs.stringify(data), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    .then((axiosRes) => {
      const appId = axiosRes.data.app_id
      const teamId = axiosRes.data.team.id
      const accessToken = axiosRes.data.access_token
      console.log({ teamId, accessToken })
      storeCredentials(teamId, accessToken).then(() => {
        const redirectTo = `slack://app?team=${teamId}&id=${appId}`
        res.redirect(301, redirectTo)
      })
    })
    .catch((err) => {
      console.log('error', err)
      res.send('Something has gone wrong')
    })
})

app.post('/poll', (req, res) => {
  const id = `${req.body.team_id}-${req.body.channel_id}-${req.body.user_id}`
  const author = req.body.user_id
  const { question, options } = questionExtractor(req.body.text)
  console.log({ id, command: req.body.command + ' ' + req.body.text })

  handleSlashCommand(id, question, options, author, req.body).then(() => res.send('OK'))
})

app.post('/interactions', (req, res) => {
  const payload = JSON.parse(req.body.payload)
  const id = `${payload.team.id}-${payload.channel.id}-${payload.container.message_ts}`
  const action = payload.actions[0].value
  console.log({ id, action })

  handleSlackInteractions(action, id, payload).then(() => res.send('OK'))
})
