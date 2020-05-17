import * as util from 'util'

import { Interactions, Poll } from './domain'

const emojiLookup = (number: number): string => {
  interface Lookups {
    [id: number]: string
  }

  const lookupTable: Lookups = {
    1: ':one:',
    2: ':two:',
    3: ':three:',
    4: ':four:',
    5: ':five:',
    6: ':six:',
    7: ':seven:',
    8: ':eight:',
    9: ':nine:',
    10: ':keycap_ten:',
  }

  return lookupTable[number] || ':hash:'
}

export const prettyPrint = (data: any) => {
  console.log('blocks', util.inspect(data, false, null, true))
}

export const describePoll = (poll: Poll) => {
  let pollTransparency = ':couple: Public poll'
  if (poll.isAnon) {
    pollTransparency = ':bust_in_silhouette: Anonymous poll'
  }

  let votingLimits = `:free: unlimited votes`
  if (poll.voteType === 'LIMITED' && poll.votesLimit !== 1) {
    votingLimits = `:hash: ${poll.votesLimit} votes`
  }
  if (poll.voteType === 'LIMITED' && poll.votesLimit === 1) {
    votingLimits = `:hash: 1 vote`
  }

  return `${pollTransparency}, ${votingLimits} | Created by <@${poll.createdBy}>`
}

export const createDraftSlackPoll = (poll: Poll) => {
  const result = []

  result.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${poll.question}* `,
    },
  })

  result.push({
    type: 'context',
    elements: [
      {
        text: describePoll(poll),
        type: 'mrkdwn',
      },
    ],
  })

  result.push({
    type: 'divider',
  })

  let index = 0
  poll.options.forEach((option: string) => {
    index++
    const votesString = 'no votes'

    result.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emojiLookup(index)} *${option}* _(${votesString})_\n`,
      },
    })
  })

  result.push({
    type: 'divider',
  })

  result.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'How many votes are allowed?',
    },
  })

  const elements = [
    {
      type: 'button',
      text: {
        type: 'plain_text',
        emoji: true,
        text: 'Unlimited votes',
      },
      value: Interactions.SetVotesUnlimited,
    },
    {
      type: 'button',
      text: {
        type: 'plain_text',
        emoji: true,
        text: '1',
      },
      value: Interactions.SetVotesOne,
    },
    {
      type: 'button',
      text: {
        type: 'plain_text',
        emoji: true,
        text: '2',
      },
      value: Interactions.SetVotesTwo,
    },
  ]
  if (poll.options.length >= 3) {
    elements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        emoji: true,
        text: '3',
      },
      value: Interactions.SetVotesThree,
    })
  }

  result.push({
    type: 'actions',
    elements,
  })

  result.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'Do you want votes to be public?',
    },
  })

  result.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          emoji: true,
          text: 'Show names of who voted',
        },
        value: Interactions.SetPublicVote,
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          emoji: true,
          text: 'Hide who voted for what',
        },
        value: Interactions.SetPrivateVote,
      },
    ],
  })

  result.push({
    type: 'divider',
  })

  result.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          emoji: true,
          text: 'Start Poll',
        },
        style: 'primary',
        value: Interactions.StartPoll,
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          emoji: true,
          text: 'Discard Poll',
        },
        style: 'danger',
        value: Interactions.DiscardPoll,
      },
    ],
  })

  return result
}

export const createSlackPoll = (poll: Poll) => {
  const result = []

  result.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${poll.question}* `,
    },
  })

  result.push({
    type: 'context',
    elements: [
      {
        text: describePoll(poll),
        type: 'mrkdwn',
      },
    ],
  })

  result.push({
    type: 'divider',
  })

  let index = 0
  poll.options.forEach((option: string) => {
    index++

    const voters: string[] = Object.keys(poll.votes).filter((poller) => poll.votes[poller].values.includes(index))

    let votesString = `${voters.length} votes`
    if (voters.length === 0) {
      votesString = 'no votes'
    }
    if (voters.length === 1) {
      votesString = '1 vote'
    }

    let votersList = voters.map((voter: string) => `<@${voter}>`).join(', ')
    if (poll.isAnon) {
      votersList = ':thumbsup:'.repeat(voters.length)
    }

    result.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emojiLookup(index)} *${option}* _(${votesString})_\n${votersList}`,
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          emoji: true,
          text: 'Vote',
        },
        value: `vote_${index}`,
      },
    })
  })

  result.push({
    type: 'divider',
  })

  result.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          emoji: true,
          text: 'Finish Poll',
        },
        value: Interactions.FinishPoll,
        confirm: {
          title: {
            type: 'plain_text',
            text: 'Are you sure?',
          },
          text: {
            type: 'mrkdwn',
            text: 'Do you want to close the poll?',
          },
          confirm: {
            type: 'plain_text',
            text: 'Do it',
          },
          deny: {
            type: 'plain_text',
            text: "Stop, I've changed my mind!",
          },
        },
      },
    ],
  })

  return result
}

export const createPollSummary = (poll: Poll) => {
  const result = []

  result.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${poll.question}* `,
    },
  })

  result.push({
    type: 'context',
    elements: [
      {
        text: describePoll(poll),
        type: 'mrkdwn',
      },
    ],
  })

  result.push({
    type: 'divider',
  })

  let index = 0
  poll.options.forEach((option: string) => {
    index++

    const voters: string[] = Object.keys(poll.votes).filter((poller) => poll.votes[poller].values.includes(index))

    let votesString = `${voters.length} votes`
    if (voters.length === 0) {
      votesString = 'no votes'
    }
    if (voters.length === 1) {
      votesString = '1 vote'
    }

    let votersList = voters.map((voter: string) => `<@${voter}>`).join(', ')
    if (poll.isAnon) {
      votersList = ':thumbsup:'.repeat(voters.length)
    }

    result.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emojiLookup(index)} *${option}* _(${votesString})_\n${votersList}`,
      },
    })
  })

  result.push({
    type: 'divider',
  })

  let winners: string[] = []
  let topScore = 0
  let summary = `No option was voted for`
  index = 0
  poll.options.forEach((option: string) => {
    index++
    const voterCount: number = Object.keys(poll.votes).filter((poller) => poll.votes[poller].values.includes(index)).length

    if (voterCount > topScore) {
      winners = [option]
      topScore = voterCount
      summary = `:trophy: Poll won by *${option}*`
    } else if (voterCount === topScore) {
      winners.push(option)
      summary = `:trophy: Poll resulted in a draw with *${winners.join(', ')}*`
    }
  })

  result.push({
    type: 'context',
    elements: [
      {
        text: summary,
        type: 'mrkdwn',
      },
    ],
  })

  return result
}
