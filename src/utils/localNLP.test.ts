import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSentences,
  sentenceCosineSimilarity,
  summarizeWebTextLocal,
  answerQuestionLocal
} from './localNLP';

test('extractSentences correctly breaks text into readable sentences', () => {
  const text = `The cybernetic companion initiates scanning mode. It detects key themes across the document. Advanced inverse kinematics drive the leg articulation smoothly.`;
  const sentences = extractSentences(text);
  assert.equal(sentences.length, 3);
  assert.equal(sentences[0], 'The cybernetic companion initiates scanning mode.');
});

test('sentenceCosineSimilarity evaluates semantic word overlap', () => {
  const s1 = 'The spider crawls down the webpage.';
  const s2 = 'The arachnid crawls down the online article.';
  const s3 = 'Deep ocean fish swim at extreme depths.';

  const simClose = sentenceCosineSimilarity(s1, s2);
  const simFar = sentenceCosineSimilarity(s1, s3);

  assert.ok(simClose > 0.2);
  assert.equal(simFar, 0);
});

test('summarizeWebTextLocal produces structured summary without API', () => {
  const article = `
    Autonomous web analysis enables accelerated research and data ingestion.
    By parsing DOM structures and extracting high-salience terminology, tools can synthesize complex documents in seconds.
    Users benefit from reduced cognitive load and instantaneous executive digests.
    Furthermore, privacy-centric architectures preserve user confidential information by running completely on-device without external telemetry.
    Modern applications should emphasize local intelligence pipelines for maximum resilience and data ownership.
  `;

  const summary = summarizeWebTextLocal(article, 'Autonomous Research');
  assert.ok(summary.coreThesis.length > 20);
  assert.ok(summary.executiveBullets.length >= 2);
  assert.ok(summary.metrics.wordCount > 40);
  assert.ok(summary.metrics.compressionRatio > 0);
  assert.ok(summary.touchedKeywords.length > 0);
});

test('answerQuestionLocal retrieves matching content with detailed manual deep-read recall and metrics', () => {
  const article = `The primary frequency of the cybernetic sensor array operates at 5.8 GHz. All telemetry packets are encrypted using AES-256-GCM.`;
  const memoryFacts = [
    {
      id: 'f1',
      content: 'User preference: Always format frequencies in gigahertz.',
      category: 'preference' as const,
      confidence: 1.0,
      timestamp: Date.now(),
      source: 'user_prompt' as const
    }
  ];

  const res = answerQuestionLocal('What frequency does the sensor operate at?', article, memoryFacts);
  assert.ok(res.answer.includes('5.8 GHz'));
  assert.equal(res.cognitiveMode, 'manual_deep_read');
  assert.ok(res.confidence > 0.4);
});

test('answerQuestionLocal answers identity, name, and purpose questions independently in a professional tone', () => {
  const article = `Qwen2.5 7b-instruct universal companions disconnect underlying telemetry.`;
  const res = answerQuestionLocal(
    "Who tf are you? What’s your name? What’s your purpose?",
    article
  );
  assert.ok(res.answer.includes('SPIDAR'));
  assert.ok(res.answer.toLowerCase().includes('purpose'));
  assert.ok(!res.answer.includes("Even though the article doesn't use those exact words"));
});

test('answerQuestionLocal answers general math and domain questions via Direct Qwen Synthesis', () => {
  const article = `This article is strictly about medieval agriculture and crop rotation.`;
  const mathRes = answerQuestionLocal('What is 24 * 5?', article);
  assert.ok(mathRes.answer.includes('120'));
  assert.equal(mathRes.cognitiveMode, 'qwen_direct');

  const quantumRes = answerQuestionLocal('How does quantum computing work?', article);
  assert.ok(quantumRes.answer.toLowerCase().includes('qubit'));
  assert.ok(!quantumRes.answer.toLowerCase().includes('medieval'));
  assert.equal(quantumRes.cognitiveMode, 'qwen_direct');
});

test('answerQuestionLocal professionally asks for context when given a bare friend name (never assuming it is the user) and indexes follow-up', () => {
  const article = `Modern browser companions rely on downward web crawlers.`;

  // 1. Typing a bare friend's name ("Marcus Vance") must NEVER assume it is the user's own name—it must ask for context professionally
  const bareNameAsk = answerQuestionLocal('Marcus Vance', article, [], [], []);
  assert.equal(bareNameAsk.cognitiveMode, 'context_clarification');
  assert.ok(bareNameAsk.answer.includes('Marcus Vance'));
  assert.ok(bareNameAsk.answer.toLowerCase().includes('context'));
  assert.ok(!bareNameAsk.answer.includes('User Identity: Marcus Vance'));

  // 2. Follow up with "It's my friend dude" after typing the bare name
  const history = [
    { role: 'user', content: 'Marcus Vance' },
    { role: 'assistant', content: bareNameAsk.answer }
  ];
  const teachReply = answerQuestionLocal("It's my friend dude", article, [], [], history);
  assert.equal(teachReply.cognitiveMode, 'second_brain_recall');
  assert.ok(teachReply.answer.includes('Marcus Vance'));
  assert.ok(teachReply.answer.toLowerCase().includes('friend'));
  assert.ok(teachReply.answer.includes('Second Brain'));

  // 3. Direct lowercase name + slang teaching in a single turn receives a professional confirmation
  const directLower = answerQuestionLocal('jayden chen is my bro type shi ykyk', article, [], [], []);
  assert.ok(directLower.answer.includes('Jayden Chen'));
  assert.ok(directLower.answer.toLowerCase().includes('bro'));
  assert.ok(directLower.answer.includes('Understood'));
});
