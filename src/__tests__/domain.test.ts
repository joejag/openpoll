import { questionExtractor } from '../domain'

test('extract poll parts - no quotes', () => {
  expect(questionExtractor('question a1 a2').question).toEqual('question')
  expect(questionExtractor('question a1 a2').options).toEqual(['a1', 'a2'])

  expect(questionExtractor('q? a1 a2').question).toEqual('q?')
  expect(questionExtractor('q? a1 a2').options).toEqual(['a1', 'a2'])
})

test('extract poll parts - all quoted', () => {
  expect(questionExtractor('"a longer question?" "a1" "a2"').question).toEqual('a longer question?')
  expect(questionExtractor('"a longer question?" "a1" "a2"').options).toEqual(['a1', 'a2'])
})

test('extract poll parts - mixture of quoted and not', () => {
  expect(questionExtractor('"Where should we go on holiday?" France Spain').question).toEqual('Where should we go on holiday?')
  expect(questionExtractor('"Where should we go on holiday?" France Spain').options).toEqual(['France', 'Spain'])

  expect(questionExtractor('q? "a1 here" a2').question).toEqual('q?')
  expect(questionExtractor('q? "a1 here" a2').options).toEqual(['a1 here', 'a2'])
})

test('with weird Slack quotes', () => {
  expect(questionExtractor('“Where should we go on holiday?” “Ivory Coast” France “Cape Verde Islands”').question).toEqual('Where should we go on holiday?')
  expect(questionExtractor('“Where should we go on holiday?” “Ivory Coast” France “Cape Verde Islands”').options).toEqual([
    'Ivory Coast',
    'France',
    'Cape Verde Islands',
  ])
})
