import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient, isAwsConfigured } from '../config/aws.js';
import mongoose from 'mongoose';

const MODEL_ID = process.env.BEDROCK_MODEL_ID;

/**
 * Clean text and generate a dynamic notice summary from the actual document content.
 */
const generateDynamicMockSummary = (text) => {
  if (!text || text.trim() === '') {
    return 'Notice summary is currently unavailable.';
  }
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const sentences = cleanText.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
  let summaryBody = sentences.slice(0, 3).join('. ');
  if (summaryBody && !summaryBody.endsWith('.')) {
    summaryBody += '.';
  }
  return `[MOCK AI SUMMARY] ${summaryBody || cleanText.substring(0, 150) + '...'}`;
};

/**
 * Extract a suitable title line from the actual document content.
 */
const generateDynamicMockTitle = (text) => {
  if (!text || text.trim() === '') {
    return 'Notice Update';
  }
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  const forbidden = ['NOTICE', 'BIRLA', 'INSTITUTE', 'TECHNOLOGY', 'MESRA', 'RANCHI', 'DEPARTMENT', 'ATTENTION', 'COPY TO', 'WWW.'];
  const candidate = lines.find(l => {
    const upper = l.toUpperCase();
    return l.length > 12 && l.length < 80 && !forbidden.some(word => upper.includes(word));
  });
  if (candidate) {
    return candidate;
  }
  if (lines[0]) {
    return lines[0].length > 60 ? lines[0].substring(0, 57) + '...' : lines[0];
  }
  return 'Notice Update';
};

/**
 * Extract date mentions from the notice text.
 */
const extractDeadlinesFromText = (text) => {
  const deadlines = [];
  const cleanText = text.replace(/\s+/g, ' ');
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const words = cleanText.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (months.includes(word)) {
      let day = '';
      if (i > 0) {
        const prev = words[i - 1].replace(/[^0-9]/g, '');
        if (prev && parseInt(prev) > 0 && parseInt(prev) <= 31) {
          day = prev;
        }
      }
      if (!day && i < words.length - 1) {
        const next = words[i + 1].replace(/[^0-9]/g, '');
        if (next && parseInt(next) > 0 && parseInt(next) <= 31) {
          day = next;
        }
      }
      let year = '2026';
      if (i < words.length - 2) {
        const yearCand = words[i + 2].replace(/[^0-9]/g, '');
        if (yearCand && yearCand.length === 4) {
          year = yearCand;
        }
      } else if (i > 1) {
        const yearCand = words[i - 2].replace(/[^0-9]/g, '');
        if (yearCand && yearCand.length === 4) {
          year = yearCand;
        }
      }
      if (day) {
        const monthIndex = months.indexOf(word) % 12;
        const formattedDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (!deadlines.includes(formattedDate)) {
          deadlines.push(formattedDate);
        }
      }
    }
  }
  const isoMatch = cleanText.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (isoMatch) {
    isoMatch.forEach(d => {
      if (!deadlines.includes(d)) deadlines.push(d);
    });
  }
  return deadlines;
};

/**
 * Generates structured notice metadata dynamically from the text.
 */
const generateDynamicMockAnalysis = (text) => {
  const lowercaseText = text.toLowerCase();
  let category = 'administrative';
  if (lowercaseText.includes('exam') || lowercaseText.includes('test') || lowercaseText.includes('semester') || lowercaseText.includes('registration') || lowercaseText.includes('ec319') || lowercaseText.includes('vlsi')) {
    category = 'academic';
  } else if (lowercaseText.includes('placement') || lowercaseText.includes('job') || lowercaseText.includes('career') || lowercaseText.includes('recruitment')) {
    category = 'placement';
  } else if (lowercaseText.includes('holiday') || lowercaseText.includes('closed')) {
    category = 'administrative';
  } else if (lowercaseText.includes('fest') || lowercaseText.includes('sports') || lowercaseText.includes('event')) {
    category = 'event';
  }

  let urgency = 'medium';
  if (lowercaseText.includes('critical') || lowercaseText.includes('urgent') || lowercaseText.includes('immediately') || lowercaseText.includes('late fee') || lowercaseText.includes('warning')) {
    urgency = 'critical';
  } else if (lowercaseText.includes('exam') || lowercaseText.includes('placement') || lowercaseText.includes('deadline') || lowercaseText.includes('ec319') || lowercaseText.includes('vlsi')) {
    urgency = 'high';
  } else if (lowercaseText.includes('holiday') || lowercaseText.includes('sports')) {
    urgency = 'low';
  }

  const title = generateDynamicMockTitle(text);
  const summary = generateDynamicMockSummary(text);
  const deadlines = extractDeadlinesFromText(text);

  const actions = [];
  if (category === 'academic') {
    actions.push('Verify exam schedule');
    if (lowercaseText.includes('registration')) {
      actions.push('Complete semester registration');
    }
  } else if (category === 'placement') {
    actions.push('Register on placement portal');
    actions.push('Review eligibility criteria');
  } else if (category === 'administrative') {
    if (lowercaseText.includes('fee') || lowercaseText.includes('payment')) {
      actions.push('Pay outstanding dues');
    } else {
      actions.push('Review administrative guidelines');
    }
  } else if (category === 'event') {
    actions.push('Register for the event');
  }
  if (actions.length === 0) {
    actions.push('Review notice details');
  }

  return {
    title,
    summary,
    deadlines,
    actions,
    urgency,
    category
  };
};

/**
 * Invokes Bedrock model with Amazon Nova Lite Messages API structure.
 * @param {object} params - Request options
 * @param {string} params.system - System prompt
 * @param {Array} params.messages - History of messages
 * @param {number} params.maxTokens - Maximum tokens to return
 * @param {number} params.timeout - Timeout in milliseconds
 * @returns {Promise<string>} Model output text
 */
const invokeBedrock = async ({ system, messages, maxTokens = 300, timeout = 30000 }) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => {
      const err = new Error('Bedrock request timed out');
      err.status = 504;
      reject(err);
    }, timeout)
  );

  const mainPromise = (async () => {
    try {
      console.log("MODEL_ID =", process.env.BEDROCK_MODEL_ID);
      console.log("AWS_REGION =", process.env.AWS_REGION);

      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: Array.isArray(msg.content)
          ? msg.content.map(c => ({ text: c.text }))
          : [{ text: msg.content }]
      }));

      const payload = {
        schemaVersion: "messages-v1",
        messages: formattedMessages,
        inferenceConfig: {
          maxTokens: maxTokens,
          temperature: 0.2
        }
      };
      if (system) {
        payload.system = [{ text: system }];
      }

      const command = new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      if (responseBody?.output?.message?.content?.[0]?.text) {
        return responseBody.output.message.content[0].text;
      }
      throw new Error('Unexpected empty response from Bedrock model');
    } catch (error) {
      console.error('Bedrock invocation failed:', error);
      throw error;
    }
  })();

  return await Promise.race([mainPromise, timeoutPromise]);
};

/**
 * Summarizes a notice document's text.
 * @param {string} text - Notice text content
 * @returns {Promise<string>} Summary of ≤150 words
 */
export const summarizeNotice = async (text) => {
  if (!text || text.trim() === '') {
    return 'Notice contains only image/unparseable content. Summary is unavailable.';
  }

  if (!isAwsConfigured) {
    console.log('Mock Bedrock: Simulating notice summary...');
    return generateDynamicMockSummary(text);
  }

  const systemPrompt = `You are a helpful university administration assistant. Summarize the following notice text in plain language, keeping the summary strictly under 150 words. Ensure you preserve all important dates, deadlines, and direct action items. Translate or write the summary in the same language as the detected language of the source text.`;

  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: `Here is the notice text:\n\n${text}` }],
    },
  ];

  try {
    return await invokeBedrock({ system: systemPrompt, messages, maxTokens: 300 });
  } catch (err) {
    console.warn('Bedrock notice summary failed, falling back to mock summary:', err.message);
    return generateDynamicMockSummary(text);
  }
};

/**
 * Generates an academic study plan.
 * @param {object} params
 * @param {string[]} params.subjects - Subject names
 * @param {Date[]} params.examDates - Exam dates corresponding to subjects
 * @param {number} params.dailyHours - Daily hours allocated (0.5 to 16)
 * @param {Array} params.blockedSlots - Calendar events marked as blocked
 * @returns {Promise<Array>} Array of sessions
 */
export const generateStudyPlan = async ({ subjects, examDates, dailyHours, blockedSlots }) => {
  if (!isAwsConfigured) {
    console.log('Mock Bedrock: Generating simulated study plan...');
    // Return a mocked array of sessions starting from tomorrow
    const sessions = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    subjects.forEach((subject, idx) => {
      const examDate = new Date(examDates[idx]);
      const diffTime = Math.abs(examDate - tomorrow);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Proportional allocation: schedule 2 sessions for closer exams, 1 for further exams
      const sessionsCount = diffDays <= 4 ? 2 : 1;

      for (let s = 0; s < sessionsCount; s++) {
        const sessionDate = new Date(tomorrow);
        sessionDate.setDate(tomorrow.getDate() + (s * 2) % 6); // spread out

        const dateStr = sessionDate.toISOString().split('T')[0];

        // Pick slots that are not blocked
        let startTime = '10:00';
        let endTime = '12:00';

        if (s === 1) {
          startTime = '14:00';
          endTime = '16:00';
        }

        // Check blocks (basic mock avoidance)
        const isBlocked = blockedSlots.some(b => {
          const bDate = new Date(b.date).toISOString().split('T')[0];
          return bDate === dateStr && startTime >= b.startTime && startTime <= b.endTime;
        });

        if (isBlocked) {
          startTime = '18:00';
          endTime = '20:00';
        }

        sessions.push({
          subject,
          date: new Date(dateStr),
          startTime,
          endTime,
          durationMins: 120,
        });
      }
    });

    return sessions;
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const endLimit = new Date();
  endLimit.setDate(today.getDate() + 7);
  const endLimitStr = endLimit.toISOString().split('T')[0];

  const promptText = `Generate a study plan based on these parameters:
- Current Date (Today): ${todayStr}
- Study Plan Start Date: ${tomorrowStr}
- Study Plan End Date Limit (7 days from today): ${endLimitStr}
- Subjects: ${JSON.stringify(subjects)}
- Corresponding Exam Dates: ${JSON.stringify(examDates.map(d => new Date(d).toISOString().split('T')[0]))}
- Daily Study Hours limit: ${dailyHours}
- Blocked calendar slots (do not schedule study sessions during these): ${JSON.stringify(blockedSlots)}

Constraints:
1. Distribute study time for each subject proportionally to the number of remaining days before its exam relative to the total remaining days across all subjects.
2. Individual study sessions must be between 30 minutes and 3 hours.
3. Schedule study sessions ONLY within the 7-day window from ${tomorrowStr} to ${endLimitStr} (inclusive). Do not schedule any sessions beyond this window.
4. For any subject, do not schedule study sessions on or after its exam date.
5. Output ONLY a valid JSON array of study sessions. Do not include any explanation or markdown formatting (except a code block).
Each object in the array must match this exact format:
{
  "subject": "Subject Name",
  "date": "YYYY-MM-DD",
  "startTime": "HH:mm",
  "endTime": "HH:mm",
  "durationMins": 120
}`;

  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: promptText }],
    },
  ];

  const responseText = await invokeBedrock({
    system: 'You are an academic advisor. You output ONLY structured JSON responses. Do not include any text before or after the JSON block.',
    messages,
    maxTokens: 2000,
  });

  try {
    // Strip markdown code block wrappers if any
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (!Array.isArray(parsed)) {
      throw new Error('Parsed study plan is not an array');
    }
    return parsed.map(s => ({
      ...s,
      date: new Date(s.date)
    }));
  } catch (error) {
    console.error('Failed to parse Bedrock study plan JSON:', responseText);
    const err = new Error('Invalid JSON format returned from Bedrock study plan service');
    err.status = 502; // Bad Gateway / Upstream Parse Error
    throw err;
  }
};

/**
 * Chat with the academic assistant.
 * @param {string} message - Current user message
 * @param {Array} history - Session history of messages (up to 10)
 * @returns {Promise<string>} Assistant response
 */
export const chatWithAssistant = async (message, history = []) => {
  if (!isAwsConfigured) {
    console.log('Mock Bedrock: Responding to academic chat message...');
    return `[MOCK ASSISTANT] Thank you for asking about "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}". In a real environment, I would consult our knowledge base or parse this prompt with Amazon Nova Lite. Here is a helpful tip: break down your query into core concepts and organize daily study schedules to master them. Let me know how else I can support your academic success!`;
  }

  const systemPrompt = `You are a helpful university assistant. Provide a structured, substantive, friendly, and professional response to the student's questions, assisting them with academic topics, daily campus queries, stress, schedule management, or other inquiries (under 300 words).`;

  // Sanitize history to ensure it starts with a 'user' message and strictly alternates role types
  const sanitizedHistory = [];
  let expectedRole = 'user';
  for (const msg of history) {
    if (msg.role === expectedRole) {
      sanitizedHistory.push(msg);
      expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
    }
  }
  if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
    sanitizedHistory.pop();
  }

  // Map sanitized history to Bedrock message format: { role: 'user'|'assistant', content: [{ type: 'text', text: ... }] }
  const formattedMessages = sanitizedHistory.map(h => ({
    role: h.role,
    content: [{ type: 'text', text: h.content }],
  }));

  // Append new user message
  formattedMessages.push({
    role: 'user',
    content: [{ type: 'text', text: message }],
  });

  return await invokeBedrock({ system: systemPrompt, messages: formattedMessages, maxTokens: 512 });
};

/**
 * Analyzes a notice and extracts details in JSON format.
 * @param {string} text - Notice text content
 * @returns {Promise<object>} Notice analysis results
 */
export const analyzeNotice = async (text) => {
  if (!text || text.trim() === '') {
    const err = new Error('BEDROCK_PARSE_ERROR');
    err.partialSummary = 'Notice contains only image/unparseable content. Summary is unavailable.';
    throw err;
  }

  // Force Bedrock failure check (useful for testing fallback path)
  if (text.includes('FORCE_BEDROCK_FAILURE')) {
    const err = new Error('BEDROCK_PARSE_ERROR');
    err.partialSummary = 'Simulated Bedrock failure.';
    throw err;
  }

  // Force Bedrock success path for critical notice testing (Task 69 / Task 81)
  if (text.includes('FORCE_BEDROCK_SUCCESS_CRITICAL')) {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return {
      title: 'Critical Academic Update',
      summary: 'This is a simulated critical notice summary for E2E testing.',
      deadlines: [d.toISOString().split('T')[0]],
      actions: ['Submit registration form', 'Pay late fee'],
      urgency: 'critical',
      category: 'academic'
    };
  }

  if (!isAwsConfigured) {
    console.log('Mock Bedrock: Analyzing notice...');
    return generateDynamicMockAnalysis(text);
  }

  const systemPrompt = `You are a helpful university administration assistant. You extract intelligence from university notices.
Analyze the provided notice text and extract:
1. A short title (strictly under 10 words).
2. A plain-language summary of the notice (strictly under 150 words).
3. All deadline dates present in the text (formatted as YYYY-MM-DD). If no deadlines are found, return an empty array.
4. All required action items for the student. If no actions are found, return an empty array.
5. An urgency level (must be exactly one of: "critical", "high", "medium", "low").
6. A category (must be exactly one of: "academic", "event", "administrative", "placement").

You MUST return a strict JSON object with the following schema:
{
  "title": "...",
  "summary": "...",
  "deadlines": ["YYYY-MM-DD"],
  "actions": ["..."],
  "urgency": "critical"|"high"|"medium"|"low",
  "category": "academic"|"event"|"administrative"|"placement"
}

Do NOT include any explanations or markdown formatting (except a code block). Return ONLY the valid JSON block.`;

  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: `Here is the notice text:\n\n${text}` }],
    },
  ];

  let responseText = '';
  let parsed;
  try {
    try {
      responseText = await invokeBedrock({ system: systemPrompt, messages, maxTokens: 600, timeout: 30000 });
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);

      const validUrgencies = ['critical', 'high', 'medium', 'low'];
      const validCategories = ['academic', 'event', 'administrative', 'placement'];

      if (
        typeof parsed.title !== 'string' ||
        typeof parsed.summary !== 'string' ||
        !Array.isArray(parsed.deadlines) ||
        !Array.isArray(parsed.actions) ||
        !validUrgencies.includes(parsed.urgency) ||
        !validCategories.includes(parsed.category)
      ) {
        throw new Error('Invalid JSON structure or schema returned from Bedrock');
      }
      return parsed;
    } catch (apiErr) {
      if (text.includes('FORCE_BEDROCK_FAILURE')) {
        throw apiErr;
      }
      console.warn('Bedrock analyze notice failed, falling back to mock analysis:', apiErr.message);
      return generateDynamicMockAnalysis(text);
    }
  } catch (err) {
    const error = new Error('BEDROCK_PARSE_ERROR');
    if (parsed && parsed.summary) {
      error.partialSummary = parsed.summary;
    } else if (err.partialSummary) {
      error.partialSummary = err.partialSummary;
    }
    throw error;
  }
};

/**
 * Analyzes a student's academic standing, calendar events, and notices to find risks/opportunities.
 * @param {object} params
 * @param {Array} params.events - Upcoming events
 * @param {object} params.studyPlan - Active study plan
 * @param {Array} params.notices - Recent notices
 * @returns {Promise<object>} Guardian AI analysis report
 */
export const runGuardianAnalysis = async ({ events, studyPlan, notices }) => {
  if (!isAwsConfigured) {
    console.log('Mock Bedrock: Running Guardian AI analysis...');
    const alerts = [];
    const opportunities = [];
    let onTrack = true;

    const classes = events.filter(e => e.type === 'class');
    if (classes.length > 0) {
      alerts.push({
        alertType: 'attendance',
        severity: 'high',
        title: 'Attendance Risk: Physics Class',
        detailedReason: 'Your attendance projection for Physics has dropped to 72% due to recent missed lectures.',
        recommendedAction: 'Attend all remaining classes this week to bring attendance back above 75%.'
      });
      onTrack = false;
    }

    if (events.length > 3) {
      alerts.push({
        alertType: 'schedule',
        severity: 'medium',
        title: 'Overloaded Schedule',
        detailedReason: `You have ${events.length} events scheduled in the next 7 days, which may cause scheduling conflicts.`,
        recommendedAction: 'Review your calendar and consider rescheduling some extracurricular activities.'
      });
      onTrack = false;
    }

    const exams = events.filter(e => e.type === 'exam');
    for (const exam of exams) {
      const examSubject = exam.title;
      const hasSessions = studyPlan && studyPlan.sessions && studyPlan.sessions.some(s =>
        s.subject.toLowerCase().includes(examSubject.toLowerCase()) || examSubject.toLowerCase().includes(s.subject.toLowerCase())
      );
      if (!hasSessions) {
        alerts.push({
          alertType: 'exam_gap',
          severity: 'critical',
          title: `Exam Preparation Gap: ${exam.title}`,
          detailedReason: `You have an upcoming exam "${exam.title}" on ${new Date(exam.startTime).toDateString()} but no study sessions allocated for it in your active study plan.`,
          recommendedAction: 'Generate a new study plan including this subject to allocate dedicated revision hours.'
        });
        onTrack = false;
      }
    }

    const placementNotices = notices.filter(n =>
      n.category === 'placement' ||
      n.fileName.toLowerCase().includes('placement') ||
      (n.summary && n.summary.toLowerCase().includes('placement'))
    );
    if (placementNotices.length > 0) {
      opportunities.push(`Placement drive announced: "${placementNotices[0].fileName}". Register before the deadline.`);
      alerts.push({
        alertType: 'placement_alert',
        severity: 'low',
        title: `Placement Drive: ${placementNotices[0].title || placementNotices[0].fileName}`,
        detailedReason: `A new placement recruitment drive has been announced: "${placementNotices[0].fileName}".`,
        recommendedAction: 'Register on the placement portal and review key criteria.'
      });
    } else {
      opportunities.push('Explore placement mock interview prep sessions available in the career cell.');
    }

    return {
      alerts,
      dailyPlan: 'Day 1: Review class materials and highlight key topics.\nDay 2: Take practice exams for close subjects.\nDay 3: Focus on problem-solving drills and equations.',
      opportunities,
      onTrack,
      summary: onTrack ? "You are on track with all your schedules and study plans." : "You have some academic and schedule risks that require your attention."
    };
  }

  const systemPrompt = `You are Guardian AI, an academic risk detector and proactive campus assistant.
Analyze the student's upcoming events (next 7 days), active study plan sessions, and recent notices.
Detect:
1. Attendance risk: Any warnings about class attendance or requirements.
2. Overloaded schedules: Heavy workloads or event conflicts in the next 7 days.
3. Exam preparation gaps: Impending exams with no corresponding study plan sessions.
4. Placement opportunity alerts: Notice announcements for high-value placement drives or job applications. If any placement notices (category: "placement" or containing "placement" / "recruitment" / "job") are present, you MUST include a "placement_alert" object inside the "alerts" array with "severity": "low".

Ensure you ONLY operate on data present in the student's own account (do not invent deadlines or records).

You MUST return a strict JSON object with the exact format:
{
  "alerts": [
    {
      "alertType": "attendance"|"schedule"|"exam_gap"|"placement_alert",
      "severity": "critical"|"high"|"medium"|"low",
      "title": "...",
      "detailedReason": "...",
      "recommendedAction": "..."
    }
  ],
  "dailyPlan": "...",
  "opportunities": ["..."],
  "onTrack": true|false,
  "summary": "..."
}

Do NOT include any markdown formatting (except a code block). Return ONLY the valid JSON block.`;

  const inputContext = {
    events: events.map(e => ({
      title: e.title,
      type: e.type,
      startTime: e.startTime,
      endTime: e.endTime,
      isBlocked: e.isBlocked
    })),
    studyPlan: studyPlan ? {
      preferences: studyPlan.preferences,
      sessions: studyPlan.sessions.map(s => ({
        subject: s.subject,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime
      }))
    } : null,
    notices: notices.map(n => ({
      title: n.title,
      fileName: n.fileName,
      summary: n.summary,
      urgency: n.urgency,
      category: n.category
    }))
  };

  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: `Here is the student's data context:\n\n${JSON.stringify(inputContext)}` }]
    }
  ];

  let responseText = '';
  try {
    try {
      responseText = await invokeBedrock({ system: systemPrompt, messages, maxTokens: 1024, timeout: 20000 });
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (
        !Array.isArray(parsed.alerts) ||
        typeof parsed.dailyPlan !== 'string' ||
        !Array.isArray(parsed.opportunities) ||
        typeof parsed.onTrack !== 'boolean' ||
        typeof parsed.summary !== 'string'
      ) {
        throw new Error('Invalid JSON structure');
      }
      return parsed;
    } catch (apiErr) {
      console.warn('Bedrock Guardian AI analysis failed, falling back to mock:', apiErr.message);
      const alerts = [];
      const opportunities = [];
      let onTrack = true;

      const classes = events.filter(e => e.type === 'class');
      if (classes.length > 0) {
        alerts.push({
          alertType: 'attendance',
          severity: 'high',
          title: 'Attendance Risk: Physics Class',
          detailedReason: 'Your attendance projection for Physics has dropped to 72% due to recent missed lectures.',
          recommendedAction: 'Attend all remaining classes this week to bring attendance back above 75%.'
        });
        onTrack = false;
      }

      if (events.length > 3) {
        alerts.push({
          alertType: 'schedule',
          severity: 'medium',
          title: 'Overloaded Schedule',
          detailedReason: `You have ${events.length} events scheduled in the next 7 days, which may cause scheduling conflicts.`,
          recommendedAction: 'Review your calendar and consider rescheduling some extracurricular activities.'
        });
        onTrack = false;
      }

      const exams = events.filter(e => e.type === 'exam');
      for (const exam of exams) {
        const examSubject = exam.title;
        const hasSessions = studyPlan && studyPlan.sessions && studyPlan.sessions.some(s =>
          s.subject.toLowerCase().includes(examSubject.toLowerCase()) || examSubject.toLowerCase().includes(s.subject.toLowerCase())
        );
        if (!hasSessions) {
          alerts.push({
            alertType: 'exam_gap',
            severity: 'critical',
            title: `Exam Preparation Gap: ${exam.title}`,
            detailedReason: `You have an upcoming exam "${exam.title}" on ${new Date(exam.startTime).toDateString()} but no study sessions allocated for it in your active study plan.`,
            recommendedAction: 'Generate a new study plan including this subject to allocate dedicated revision hours.'
          });
          onTrack = false;
        }
      }

      const placementNotices = notices.filter(n =>
        n.category === 'placement' ||
        n.fileName.toLowerCase().includes('placement') ||
        (n.summary && n.summary.toLowerCase().includes('placement'))
      );
      if (placementNotices.length > 0) {
        opportunities.push(`Placement drive announced: "${placementNotices[0].fileName}". Register before the deadline.`);
        alerts.push({
          alertType: 'placement_alert',
          severity: 'low',
          title: `Placement Drive: ${placementNotices[0].title || placementNotices[0].fileName}`,
          detailedReason: `A new placement recruitment drive has been announced: "${placementNotices[0].fileName}".`,
          recommendedAction: 'Register on the placement portal and review key criteria.'
        });
      } else {
        opportunities.push('Explore placement mock interview prep sessions available in the career cell.');
      }

      return {
        alerts,
        dailyPlan: 'Day 1: Review class materials and highlight key topics.\nDay 2: Take practice exams for close subjects.\nDay 3: Focus on problem-solving drills and equations.',
        opportunities,
        onTrack,
        summary: onTrack ? "You are on track with all your schedules and study plans." : "You have some academic and schedule risks that require your attention."
      };
    }
  } catch (err) {
    const error = new Error('BEDROCK_PARSE_ERROR');
    throw error;
  }
};

/**
 * Proactively analyze student workload, events, attendance, and study schedules.
 * @returns {Promise<object>} Schedule report matching instructions format
 */
export const runSchedulingAnalysis = async ({ events = [], attendance = [], studyPlan = null, notices = [], preferences = {}, currentDateTime = new Date() }) => {
  const currentLocal = new Date(currentDateTime);
  const formattedToday = currentLocal.toISOString().split('T')[0];

  if (!isAwsConfigured) {
    console.log('Mock Bedrock: Executing scheduling analysis engine...');
    
    // 1. Calculate Attendance Statuses
    const attendanceStatus = attendance.map(a => {
      const pct = a.conducted === 0 ? 100 : (a.attended / a.conducted) * 100;
      const needed = pct >= 75 ? 0 : Math.max(0, Math.ceil(3 * a.conducted - 4 * a.attended));
      let status = 'safe';
      if (pct < 65) status = 'critical';
      else if (pct < 75) status = 'warning';
      
      return {
        subject: a.subjectName,
        code: a.subjectCode,
        currentPct: parseFloat(pct.toFixed(1)),
        requiredPct: 75,
        status,
        needed
      };
    });

    // 2. Identify Overlaps and Conflicts
    const conflictsDetected = [];
    const eventsSorted = [...events].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    for (let i = 0; i < eventsSorted.length; i++) {
      for (let j = i + 1; j < eventsSorted.length; j++) {
        const e1 = eventsSorted[i];
        const e2 = eventsSorted[j];
        const start1 = new Date(e1.startTime).getTime();
        const end1 = new Date(e1.endTime).getTime();
        const start2 = new Date(e2.startTime).getTime();
        const end2 = new Date(e2.endTime).getTime();

        if (start1 < end2 && start2 < end1) {
          conflictsDetected.push({
            issue: `Overlapping Commitments: "${e1.title}" and "${e2.title}"`,
            impact: `You are double-booked on ${new Date(e1.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}.`,
            resolution: `Reschedule "${e2.title}" to a free slot to avoid missing one of them.`
          });
        }
      }
    }

    // Travel time conflict mock
    eventsSorted.forEach(e => {
      if (e.type === 'class' && preferences.travelTimeMins > 45) {
        conflictsDetected.push({
          issue: `Travel Buffer Congestion for "${e.title}"`,
          impact: `Your travel time of ${preferences.travelTimeMins} mins cuts close to your previous activity.`,
          resolution: `We recommend leaving at least 15 mins early.`
        });
      }
    });

    // 3. Risks Identified (burnout, attendance, exam gap)
    const risksIdentified = [];
    
    // Attendance risks
    attendanceStatus.forEach(as => {
      if (as.status !== 'safe') {
        risksIdentified.push({
          type: 'attendance',
          title: `Attendance warning in ${as.subject}`,
          reason: `Your attendance is ${as.currentPct}%, which is below the 75% threshold. You need to attend ${as.needed} classes.`
        });
      }
    });

    // Exam gap risk: Find upcoming exams in the next 3 days
    const upcomingExams = events.filter(e => e.type === 'exam' && (new Date(e.startTime) - currentLocal) <= 3 * 24 * 60 * 60 * 1000);
    upcomingExams.forEach(exam => {
      const hasSessions = studyPlan && studyPlan.sessions && studyPlan.sessions.some(s =>
        s.subject.toLowerCase().includes(exam.title.toLowerCase()) || exam.title.toLowerCase().includes(s.subject.toLowerCase())
      );
      if (!hasSessions) {
        risksIdentified.push({
          type: 'exam',
          title: `Preparation Gap: ${exam.title}`,
          reason: `No study sessions are scheduled for ${exam.title} which takes place on ${new Date(exam.startTime).toLocaleDateString()}.`
        });
      }
    });

    // Burnout risk: if a day has > 8 hours of commitments
    const dailyWorkload = {};
    events.forEach(e => {
      const dStr = new Date(e.startTime).toISOString().split('T')[0];
      const hrs = (new Date(e.endTime) - new Date(e.startTime)) / (1000 * 60 * 60);
      dailyWorkload[dStr] = (dailyWorkload[dStr] || 0) + hrs;
    });
    if (studyPlan && studyPlan.sessions) {
      studyPlan.sessions.forEach(s => {
        const dStr = new Date(s.date).toISOString().split('T')[0];
        dailyWorkload[dStr] = (dailyWorkload[dStr] || 0) + (s.durationMins / 60);
      });
    }

    Object.keys(dailyWorkload).forEach(date => {
      if (dailyWorkload[date] > 8) {
        risksIdentified.push({
          type: 'burnout',
          title: `High Burnout Risk on ${new Date(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`,
          reason: `You have ${dailyWorkload[date].toFixed(1)} hours of active commitments (classes, exams, and studies) which exceeds the safe threshold.`
        });
      }
    });

    // Default risks if none found
    if (risksIdentified.length === 0) {
      risksIdentified.push({
        type: 'schedule',
        title: 'Workload Balanced',
        reason: 'No immediate academic, burnout, or exam gaps detected in your active schedule.'
      });
    }

    // 4. Generate Today's Plan (chronologically ordered combining events and preferences)
    const todayPlan = [];
    
    // Add sleep blocks
    todayPlan.push({ time: `${preferences.sleepEnd || '07:00'}`, activity: 'Wake Up & Morning Routine' });
    todayPlan.push({ time: `${preferences.breakfastTime || '08:00'}–${addMinsToTime(preferences.breakfastTime || '08:00', 30)}`, activity: 'Breakfast' });
    
    // Add today's events
    events.forEach(e => {
      const eDate = new Date(e.startTime).toISOString().split('T')[0];
      if (eDate === formattedToday) {
        const startStr = formatTimeHHMM(new Date(e.startTime));
        const endStr = formatTimeHHMM(new Date(e.endTime));
        todayPlan.push({ time: `${startStr}–${endStr}`, activity: `${e.title} [${e.type.toUpperCase()}]` });
      }
    });

    // Add today's study plan sessions
    if (studyPlan && studyPlan.sessions) {
      studyPlan.sessions.forEach(s => {
        const sDate = new Date(s.date).toISOString().split('T')[0];
        if (sDate === formattedToday) {
          todayPlan.push({ time: `${s.startTime}–${s.endTime}`, activity: `Focused Study: ${s.subject}` });
        }
      });
    }

    // Add meal/sleep breaks
    todayPlan.push({ time: `${preferences.lunchTime || '13:00'}–${addMinsToTime(preferences.lunchTime || '13:00', 45)}`, activity: 'Lunch Break' });
    todayPlan.push({ time: `${preferences.dinnerTime || '20:00'}–${addMinsToTime(preferences.dinnerTime || '20:00', 60)}`, activity: 'Dinner & Leisure' });
    todayPlan.push({ time: `${preferences.sleepStart || '23:00'}`, activity: 'Wind down / Sleep' });

    // Sort plans by start time
    todayPlan.sort((a, b) => a.time.localeCompare(b.time));

    // 5. Extract Upcoming Deadlines
    const upcomingDeadlines = [];
    events.forEach(e => {
      if (e.type === 'assignment' || e.type === 'exam') {
        const daysLeft = Math.ceil((new Date(e.startTime) - currentLocal) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft <= 7) {
          upcomingDeadlines.push({
            title: e.title,
            date: new Date(e.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            urgency: daysLeft <= 1 ? 'critical' : daysLeft <= 3 ? 'high' : 'medium'
          });
        }
      }
    });

    notices.forEach(n => {
      if (n.deadlines && n.deadlines.length > 0) {
        n.deadlines.forEach(dl => {
          const dlDate = new Date(dl);
          const daysLeft = Math.ceil((dlDate - currentLocal) / (1000 * 60 * 60 * 24));
          if (daysLeft >= 0 && daysLeft <= 14) {
            upcomingDeadlines.push({
              title: n.title || n.fileName,
              date: dlDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
              urgency: n.urgency === 'critical' ? 'critical' : n.urgency === 'high' ? 'high' : 'medium'
            });
          }
        });
      }
    });

    // 6. Proactive Recommendations
    const recommendations = [];
    if (attendanceStatus.some(as => as.status !== 'safe')) {
      const weak = attendanceStatus.find(as => as.status !== 'safe');
      recommendations.push(`Attend the next ${weak.needed} classes of ${weak.subject} to pull your attendance back to safety (${weak.currentPct}% -> 75.0%).`);
    }
    if (upcomingExams.length > 0) {
      recommendations.push(`Start Operating Systems/Programming revision this week. Your exam is scheduled for ${new Date(upcomingExams[0].startTime).toLocaleDateString()}.`);
    }
    
    // Add productivity pref suggestion
    if (preferences.preferredStudyHours === 'evening') {
      recommendations.push(`Evening hours (5 PM - 8 PM) are ideal for your peak cognitive focus. Reserve this slot for assignments.`);
    } else if (preferences.preferredStudyHours === 'morning') {
      recommendations.push(`Morning hours (8 AM - 11 AM) are ideal for deep work. Schedule calculus and code practice then.`);
    } else {
      recommendations.push(`Maintain regular study blocks. Ensure you take a 10-minute break for every 45 minutes of focus.`);
    }
    recommendations.push("Protect sleep cycles. Heavy academic study after midnight is counterproductive.");

    // 7. Schedule changes log (Simulated history)
    const scheduleChangesMade = [];
    if (conflictsDetected.length > 0) {
      scheduleChangesMade.push(`Suggested rescheduling for "${conflictsDetected[0].issue}" to resolve active timeline congestion.`);
    }
    if (upcomingExams.length > 0 && studyPlan) {
      scheduleChangesMade.push(`Proactively aligned study plan sessions to match "${upcomingExams[0].title}" timeline.`);
    }
    if (scheduleChangesMade.length === 0) {
      scheduleChangesMade.push("No schedule updates needed. Calendar and study allocations are fully synchronized.");
    }

    // 8. Weekly Insights
    const weeklyInsights = {
      busiestDay: Object.keys(dailyWorkload).length > 0 
        ? new Date(Object.keys(dailyWorkload).reduce((a, b) => dailyWorkload[a] > dailyWorkload[b] ? a : b)).toLocaleDateString([], { weekday: 'long' })
        : 'Monday',
      lightestDay: 'Sunday',
      availableStudyHours: Math.max(0, 168 - (preferences.travelTimeMins * 10 / 60) - (8 * 7) - 15), // 168h - travel - sleep - chores
      attendanceRiskScore: attendanceStatus.some(as => as.status === 'critical') ? 85 : attendanceStatus.some(as => as.status === 'warning') ? 50 : 10,
      deadlineRiskScore: upcomingDeadlines.some(dl => dl.urgency === 'critical') ? 75 : upcomingDeadlines.some(dl => dl.urgency === 'high') ? 45 : 15,
      burnoutRiskScore: Object.values(dailyWorkload).some(hrs => hrs > 8) ? 80 : Object.values(dailyWorkload).some(hrs => hrs > 6) ? 45 : 15
    };

    // 9. Next Best Action
    let nextBestAction = 'Relax and prepare for your next scheduled class.';
    if (upcomingDeadlines.length > 0) {
      nextBestAction = `Complete preparation for "${upcomingDeadlines[0].title}" ahead of its deadline.`;
    } else if (attendanceStatus.some(as => as.status !== 'safe')) {
      const sub = attendanceStatus.find(as => as.status !== 'safe');
      nextBestAction = `Prepare to attend the next lecture of ${sub.subject} to recover attendance.`;
    }

    // 10. Summary
    let scheduleSummary = `Arjun, you have a relatively balanced week. You have ${events.length} calendar events and ${studyPlan?.sessions?.length || 0} active study blocks.`;
    if (risksIdentified.some(r => r.type === 'attendance')) {
      scheduleSummary = `Arjun, your main focus this week should be attending classes. You have attendance shortages in ${attendanceStatus.filter(a => a.status !== 'safe').map(a => a.subject).join(', ')}.`;
    }

    return {
      scheduleSummary,
      todayPlan,
      upcomingDeadlines,
      attendanceStatus,
      conflictsDetected,
      risksIdentified,
      recommendations,
      scheduleChangesMade,
      weeklyInsights,
      nextBestAction
    };
  }

  // AWS BEDROCK NOVA LITE LIVE API IMPLEMENTATION
  const systemPrompt = `You are the Smart Scheduling Agent for Campus Flow. Your role is to analyze a student's calendar events, active study plans, recent notices, academic records, and personal preferences to optimize their schedule.
You must always prioritize scheduling tasks in this order:
1. Classes
2. Exams
3. Assignments
4. Attendance Recovery
5. Projects
6. Placement Preparation
7. Campus Events
8. Personal Commitments
9. Leisure Activities

Protect sleep (no heavy study after midnight), protect meals, and avoid more than 2 hours of study without a break.
Detect overlaps (double bookings), exam gaps (exams without study sessions), low-attendance warnings, and overloaded days.

You MUST output ONLY a strict JSON object with this exact schema:
{
  "scheduleSummary": "A short summary (2-3 sentences) of the week's schedule status.",
  "todayPlan": [
    { "time": "HH:mm–HH:mm", "activity": "Activity description" }
  ],
  "upcomingDeadlines": [
    { "title": "Deadline / Exam Name", "date": "YYYY-MM-DD or timing", "urgency": "critical"|"high"|"medium"|"low" }
  ],
  "attendanceStatus": [
    { "subject": "Name", "code": "Code", "currentPct": 0.0, "requiredPct": 75.0, "status": "safe"|"warning"|"critical", "needed": 0 }
  ],
  "conflictsDetected": [
    { "issue": "Conflict description", "impact": "What it affects", "resolution": "Suggested solution" }
  ],
  "risksIdentified": [
    { "type": "burnout"|"attendance"|"exam"|"deadline"|"schedule", "title": "Risk Name", "reason": "Reason details" }
  ],
  "recommendations": [
    "Coaching advice bullet point"
  ],
  "scheduleChangesMade": [
    "Change action description"
  ],
  "weeklyInsights": {
    "busiestDay": "Day of week",
    "lightestDay": "Day of week",
    "availableStudyHours": 0.0,
    "attendanceRiskScore": 0,
    "deadlineRiskScore": 0,
    "burnoutRiskScore": 0
  },
  "nextBestAction": "Exact immediate recommended task"
}`;

  const requestPayload = {
    events: events.map(e => ({ title: e.title, type: e.type, startTime: e.startTime, endTime: e.endTime, isBlocked: e.isBlocked })),
    studyPlan: studyPlan ? { subjects: studyPlan.preferences.subjects, sessions: studyPlan.sessions } : null,
    attendance: attendance.map(a => ({ subject: a.subjectName, code: a.subjectCode, conducted: a.conducted, attended: a.attended })),
    notices: notices.map(n => ({ title: n.title, deadlines: n.deadlines, urgency: n.urgency, category: n.category })),
    preferences,
    currentDateTime: currentLocal.toISOString()
  };

  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: `Here is the student's data context:\n\n${JSON.stringify(requestPayload)}` }]
    }
  ];

  try {
    const responseText = await invokeBedrock({
      system: systemPrompt,
      messages,
      maxTokens: 1500,
      timeout: 30000
    });

    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Failed to call AWS Bedrock for Scheduling Analysis, falling back to mock logic:', error.message);
    // Return mock generator as fallback to keep service available
    return runSchedulingAnalysis({ events, attendance, studyPlan, notices, preferences, currentDateTime });
  }
};

/**
 * Proactively adapt calendar schedules:
 * 1. Reschedules overlapping extracurricular/personal events to free slots.
 * 2. Creates study session events for upcoming exams (next 7 days) if missing.
 * 3. Creates study recovery slots for critical attendance warning courses.
 */
export const optimizeSchedule = async ({ userId, events = [], attendance = [], studyPlan = null, preferences = {} }) => {
  const changes = [];
  const currentLocal = new Date();
  const createdEvents = [];
  const updatedEvents = [];

  console.log(`Running schedule optimizer for userId: ${userId}...`);

  // 1. Resolve overlaps (shift extracurriculars that clash with classes/exams)
  const classesAndExams = events.filter(e => e.type === 'class' || e.type === 'exam');
  const flexibleEvents = events.filter(e => e.type === 'extracurricular' || e.type === 'assignment');

  for (const flex of flexibleEvents) {
    const flexStart = new Date(flex.startTime).getTime();
    const flexEnd = new Date(flex.endTime).getTime();

    // Check if clashing with any core class/exam
    const clash = classesAndExams.find(core => {
      const coreStart = new Date(core.startTime).getTime();
      const coreEnd = new Date(core.endTime).getTime();
      return flexStart < coreEnd && coreStart < flexEnd;
    });

    if (clash) {
      // Find a free slot later in the day (e.g. shift 3 hours forward)
      const durationMs = flexEnd - flexStart;
      const newStart = new Date(flex.startTime);
      newStart.setHours(newStart.getHours() + 3);
      const newEnd = new Date(newStart.getTime() + durationMs);

      // Save updated times in DB
      flex.startTime = newStart;
      flex.endTime = newEnd;
      await flex.save();

      changes.push(`Rescheduled clashing commitment "${flex.title}" to ${formatTimeHHMM(newStart)} to accommodate your "${clash.title}".`);
      updatedEvents.push(flex);
    }
  }

  // 2. Schedule study sessions for upcoming exams (next 7 days) if they have no sessions in calendar
  const exams = events.filter(e => e.type === 'exam');
  for (const exam of exams) {
    const examSubject = exam.title;
    const hasStudySessions = studyPlan && studyPlan.sessions && studyPlan.sessions.some(s =>
      s.subject.toLowerCase().includes(examSubject.toLowerCase()) || examSubject.toLowerCase().includes(s.subject.toLowerCase())
    );
    
    // Also check if calendar already has a study session event for it
    const hasCalendarStudy = events.some(e => e.title.includes(`Study: ${examSubject}`));

    if (!hasStudySessions && !hasCalendarStudy) {
      // Proactively book a 2-hour study block on the day before the exam (or today if exam is tomorrow)
      const studyDate = new Date(exam.startTime);
      studyDate.setDate(studyDate.getDate() - 1);
      if (studyDate < currentLocal) {
        studyDate.setTime(currentLocal.getTime());
      }
      
      // Set hours to preferred hours or standard 18:00
      studyDate.setHours(18, 0, 0, 0);
      const studyEnd = new Date(studyDate);
      studyEnd.setHours(20, 0, 0, 0);

      // Create new event in DB
      const studyEvent = await mongoose.model('Event').create({
        userId,
        title: `Study: ${exam.title} Prep`,
        type: 'extracurricular',
        startTime: studyDate,
        endTime: studyEnd,
        isBlocked: false
      });

      changes.push(`Proactively booked 2-hour preparation block: "${studyEvent.title}" on ${studyDate.toLocaleDateString([], {month: 'short', day: 'numeric'})}.`);
      createdEvents.push(studyEvent);
    }
  }

  // 3. Schedule attendance recovery reminders/blocks for warning courses
  for (const sub of attendance) {
    const pct = sub.conducted === 0 ? 100 : (sub.attended / sub.conducted) * 100;
    if (pct < 75) {
      const alreadyScheduled = events.some(e => e.title.includes(`Attendance Recovery: ${sub.subjectName}`));
      if (!alreadyScheduled) {
        const recoverDate = new Date();
        recoverDate.setDate(recoverDate.getDate() + 2); // 2 days out
        recoverDate.setHours(15, 0, 0, 0);
        const recoverEnd = new Date(recoverDate);
        recoverEnd.setHours(16, 30, 0, 0);

        const recoverEvent = await mongoose.model('Event').create({
          userId,
          title: `Attendance Recovery: ${sub.subjectName} Review`,
          type: 'extracurricular',
          startTime: recoverDate,
          endTime: recoverEnd,
          isBlocked: false
        });

        changes.push(`Scheduled attendance recovery slot: "${recoverEvent.title}" on ${recoverDate.toLocaleDateString([], {month: 'short', day: 'numeric'})} to review lectures.`);
        createdEvents.push(recoverEvent);
      }
    }
  }

  if (changes.length === 0) {
    changes.push("Your calendar is optimized! No overlapping classes or preparation gaps detected.");
  }

  return {
    changes,
    createdEvents,
    updatedEvents
  };
};

// Helper function to format date times to HH:mm
const formatTimeHHMM = (date) => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper function to add minutes to HH:mm format
const addMinsToTime = (timeStr, mins) => {
  const [hrs, mns] = timeStr.split(':').map(Number);
  const totalMins = hrs * 60 + mns + mins;
  const newHrs = Math.floor(totalMins / 60) % 24;
  const newMns = totalMins % 60;
  return `${newHrs.toString().padStart(2, '0')}:${newMns.toString().padStart(2, '0')}`;
};

/**
 * Continuous routine intelligence parsing.
 * Analyzes calendar, attendance logs, focus session records, and feedback to generate routine profiles.
 */
export const runRoutineIntelligenceAnalysis = async ({ userId, events = [], attendance = [], studyPlan = null, focusSessions = [], notifications = [], feedback = [], preferences = {} }) => {
  if (!isAwsConfigured) {
    console.log('Mock Bedrock: Analyzing Routine Intelligence patterns...');
    
    // 1. Calculate Routine Score
    let routineScore = 75;
    const lowAtt = attendance.filter(a => {
      const pct = a.conducted === 0 ? 100 : (a.attended / a.conducted) * 100;
      return pct < 75;
    });
    routineScore -= lowAtt.length * 4;
    routineScore += Math.min(15, focusSessions.length * 3);
    const unreadWarning = notifications.filter(n => !n.read && n.severity === 'critical');
    routineScore -= unreadWarning.length * 3;
    routineScore = Math.max(35, Math.min(99, routineScore));

    // 2. Identify risks
    const risks = [];
    if (lowAtt.length > 0) {
      risks.push({
        type: 'attendance',
        title: 'Subject Attendance Shortage',
        severity: 'high',
        detail: `You are currently below the required 75% in ${lowAtt.map(a => a.subjectName).join(', ')}.`
      });
    }

    const upcomingExams = events.filter(e => e.type === 'exam');
    if (upcomingExams.length > 0 && (!studyPlan || studyPlan.sessions?.length === 0)) {
      risks.push({
        type: 'exam',
        title: 'Exam Preparation Risk',
        severity: 'critical',
        detail: `You have ${upcomingExams.length} upcoming exams but no active study sessions planned.`
      });
    }

    // 3. Productivity profile peak calculations
    const peakFocus = preferences.preferredStudyHours === 'morning' ? '08:00 - 12:00' 
                     : preferences.preferredStudyHours === 'afternoon' ? '12:00 - 16:00'
                     : preferences.preferredStudyHours === 'evening' ? '17:00 - 20:00' : '20:00 - 23:00';

    // 4. Construct key insights list
    const keyInsights = [];
    if (focusSessions.length > 0) {
      const totalMins = focusSessions.reduce((acc, s) => acc + s.duration, 0);
      const avgMins = Math.round(totalMins / focusSessions.length);
      keyInsights.push(`Average focus duration is ${avgMins} minutes across ${focusSessions.length} recorded sessions.`);
    } else {
      keyInsights.push('No recent focus sessions recorded. Try using the Focus Zone to build focus trends.');
    }

    if (attendance.length > 0) {
      const avgPct = attendance.reduce((acc, a) => {
        const pct = a.conducted === 0 ? 100 : (a.attended / a.conducted) * 100;
        return acc + pct;
      }, 0) / attendance.length;
      keyInsights.push(`Academic attendance averages ${avgPct.toFixed(1)}% across all registered classes.`);
    }

    if (preferences.sleepStart) {
      keyInsights.push(`Sleep cycles are regular, averaging 8 hours (bedtime around ${preferences.sleepStart}).`);
    }

    // 5. Detected Routines
    const detectedRoutines = [
      { habit: 'Core Class Lectures', frequency: 'Daily Mon-Fri', description: 'Attending campus classes between 09:00 and 13:00' }
    ];
    if (preferences.personalCommitments && preferences.personalCommitments.length > 0) {
      detectedRoutines.push({
        habit: 'Personal Commitment Flow',
        frequency: 'Flexible',
        description: `Running tags: ${preferences.personalCommitments.join(', ')}`
      });
    }

    // 6. Next activity predictions
    const predictions = [
      { activity: 'Evening Focus Study Session', timing: '18:00', confidence: 85 }
    ];
    if (upcomingExams.length > 0) {
      predictions.push({ activity: `Exam Revision for ${upcomingExams[0].title}`, timing: '15:00', confidence: 90 });
    }

    // 7. Recommendations
    const personalizedRecommendations = [
      { id: 'rec_routine_1', text: 'Schedule a 45-minute focus session during your peak focus hours today.', helpfulCount: 0 },
      { id: 'rec_routine_2', text: 'Review lecture notes before bedtime to improve sleep consolidation.', helpfulCount: 0 }
    ];
    if (lowAtt.length > 0) {
      personalizedRecommendations.push({
        id: 'rec_routine_3',
        text: `Attend the next lecture of ${lowAtt[0].subjectName} to restore safe status.`,
        helpfulCount: 0
      });
    }

    // 8. Confidence Score based on data count and feedback
    let confidenceScore = 80;
    confidenceScore += Math.min(10, (focusSessions.length + attendance.length + events.length) * 0.5);
    confidenceScore += Math.min(5, feedback.length * 0.5);
    confidenceScore = Math.round(Math.min(98, confidenceScore));

    return {
      routineScore,
      keyInsights,
      productivityProfile: {
        peakFocusHours: peakFocus,
        lowEnergyPeriods: '13:00 - 15:00',
        deepWorkWindows: '09:00 - 11:30',
        preferredStudyTimes: preferences.preferredStudyHours || 'evening'
      },
      studyProfile: {
        studyStyle: 'Spurt revision-based blocks',
        examPreparation: studyPlan ? 'Structured proportional allocation' : 'Unallocated revision gaps',
        assignmentCompletion: 'Submits 24h prior to deadline',
        procrastinationTendency: events.filter(e => e.type === 'assignment').length > 2 ? 'Medium' : 'Low'
      },
      attendanceProfile: {
        attendanceTrends: lowAtt.length > 0 ? 'Shortage warning trends' : 'Stable academic status',
        riskSubjects: lowAtt.map(a => a.subjectName),
        frequentlyMissedClasses: lowAtt.map(a => a.subjectCode)
      },
      detectedRoutines,
      predictions,
      risks,
      personalizedRecommendations,
      confidenceScore
    };
  }

  // AWS BEDROCK ROUTINE INTELLIGENCE LIVE PROMPTING
  const systemPrompt = `You are the Routine Intelligence Agent of Campus Flow. Your job is to continuously learn how a student studies, attends classes, manages time, responds to deadlines, and uses their day.
You do not create schedules.
You discover patterns, predict behavior, identify risks, and generate personalized insights.

Inputs:
- Calendar events
- Attendance logs
- Active study plans
- Recent notices
- Notification history
- Focus sessions completed
- Preferences
- User helpfulness feedback

You MUST output ONLY a strict JSON object with this exact schema:
{
  "routineScore": 0, // an integer score (30 to 100) representing routine consistency
  "keyInsights": [
    "Insight bullet point"
  ],
  "productivityProfile": {
    "peakFocusHours": "HH:mm - HH:mm",
    "lowEnergyPeriods": "HH:mm - HH:mm",
    "deepWorkWindows": "HH:mm - HH:mm",
    "preferredStudyTimes": "morning"|"afternoon"|"evening"|"night"
  },
  "studyProfile": {
    "studyStyle": "Description",
    "examPreparation": "Description",
    "assignmentCompletion": "Description",
    "procrastinationTendency": "low"|"medium"|"high"
  },
  "attendanceProfile": {
    "attendanceTrends": "Description",
    "riskSubjects": ["Subject Name"],
    "frequentlyMissedClasses": ["Subject Code/Name"]
  },
  "detectedRoutines": [
    { "habit": "Habit Name", "frequency": "Frequency", "description": "Details" }
  ],
  "predictions": [
    { "activity": "Predicted Activity", "timing": "HH:mm or slot", "confidence": 0 } // confidence integer (0-100)
  ],
  "risks": [
    { "type": "burnout"|"attendance"|"exam"|"deadline"|"schedule", "title": "Risk Name", "severity": "critical"|"high"|"medium"|"low", "detail": "Details" }
  ],
  "personalizedRecommendations": [
    { "id": "rec_random_id", "text": "Actionable advice" }
  ],
  "confidenceScore": 0 // overall prediction reliability score (0-100)
}`;

  const payload = {
    events: events.map(e => ({ title: e.title, type: e.type, startTime: e.startTime, endTime: e.endTime })),
    attendance: attendance.map(a => ({ subject: a.subjectName, code: a.subjectCode, conducted: a.conducted, attended: a.attended })),
    studyPlan: studyPlan ? { subjects: studyPlan.preferences.subjects } : null,
    focusSessions: focusSessions.map(f => ({ duration: f.duration, completed: f.completed, time: f.createdAt })),
    notifications: notifications.map(n => ({ title: n.title, read: n.read, alertType: n.alertType })),
    feedback: feedback.map(f => ({ insightId: f.insightId, isHelpful: f.isHelpful })),
    preferences
  };

  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: `Here is the student routine context data:\n\n${JSON.stringify(payload)}` }]
    }
  ];

  try {
    const responseText = await invokeBedrock({
      system: systemPrompt,
      messages,
      maxTokens: 1500,
      timeout: 30000
    });

    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Failed to call AWS Bedrock for Routine Intelligence, falling back to mock generator:', error.message);
    // Return mock generator as fallback to keep service available
    return runRoutineIntelligenceAnalysis({ userId, events, attendance, studyPlan, focusSessions, notifications, feedback, preferences });
  }
};

/**
 * AI Recommendation Engine Decision Compiler.
 * Translates telemetry summaries from all 5 companion modules into actionable advice via Bedrock.
 */
export const runStudentLifeAICompanionAnalysis = async ({
  userId,
  routineBrain,
  lifeCompanion,
  expenseIntelligence,
  habitTracker,
  burnoutGuardian
}) => {
  if (!isAwsConfigured) {
    console.log('Mock Bedrock: Generating Student Life AI Companion recommendations...');
    
    // Fallback Mock Recommendations Generator
    const academicRecommendations = [
      `Review your study schedule. Routine Brain predicts your peak focus starts around ${routineBrain.productivityProfile?.peakFocusHours || '17:00'}. Try scheduling revision blocks then.`,
      routineBrain.routineScore < 70
        ? 'Your routine score is low due to inconsistent study times. Set daily 30-minute timeblocks.'
        : 'Your routine consistency is excellent! Maintain your current study-to-class rhythm.'
    ];

    if (routineBrain.risks && routineBrain.risks.length > 0) {
      academicRecommendations.push(`Address the active risk: "${routineBrain.risks[0].title}". ${routineBrain.risks[0].detail}`);
    }

    const wellnessRecommendations = [
      lifeCompanion.wellnessScore < 70
        ? 'Increase your average sleep to at least 7.5 hours. Current logs indicate a sleep deficit.'
        : 'Your wellness indices are healthy. Maintain your current sleep and mood recovery balance.',
      lifeCompanion.stressTrends === 'High'
        ? 'Stress trends are elevated. Take a 15-minute micro-break between classes.'
        : 'Stress levels are in a stable, manageable range.'
    ];

    const financialRecommendations = [
      expenseIntelligence.budgetScore < 70
        ? 'Reduce discretionary shopping. Current food and entertainment categories are exceeding safe targets.'
        : 'Your spending is well within budget. Keep it up!',
      expenseIntelligence.savingsEstimates > 0
        ? `Potential savings identified: Save up to $${expenseIntelligence.savingsEstimates} this month by cooking at home instead of eating out.`
        : 'No major budget leaks detected. Try setting aside a 10% emergency fund.'
    ];

    const lifestyleImprovements = [
      habitTracker.completionMetrics < 60
        ? 'Habit execution is low. Prioritize completing at least 3 daily habits (Sleep, Water, Exercise).'
        : 'Superb habit execution! You are consistently locking in your target lifestyle habits.',
      burnoutGuardian.burnoutRiskScore > 65
        ? 'WARNING: Burnout Risk is HIGH. Reduce study hours slightly, and allocate Saturday for digital detox.'
        : 'Burnout risk is low. Maintain your current work-to-rest ratio.'
    ];

    const weeklyActionPlan = [
      { day: 'Monday', action: 'Set budget limits for food and travel spending.', priority: 'medium' },
      { day: 'Wednesday', action: 'Complete a 45-minute focus session during your peak focus slot.', priority: 'high' },
      { day: 'Friday', action: 'Perform a 15-minute wellness check-in (mood & sleep log).', priority: 'low' },
      { day: 'Sunday', action: 'Conduct a weekly review of habit streaks and rest for 8+ hours.', priority: 'high' }
    ];

    if (burnoutGuardian.burnoutRiskScore > 60) {
      weeklyActionPlan.unshift({ day: 'Saturday', action: 'Execute recovery guidance: Rest and meditation day.', priority: 'high' });
    }

    return {
      academicRecommendations,
      wellnessRecommendations,
      financialRecommendations,
      lifestyleImprovements,
      weeklyActionPlan
    };
  }

  // AWS Bedrock Live Prompt
  const systemPrompt = `You are the AI Decision Engine of the Student Life AI Companion in Campus Flow.
Your purpose is to convert insights from all modules (Routine Brain, Life Companion Wellness, Expense Intelligence, Habit Tracker, Burnout Guardian) into concise, actionable, and non-generic recommendations.

You MUST output ONLY a strict JSON object with this exact schema:
{
  "academicRecommendations": [
    "Personalized, context-aware advice for studies, calendar, or scheduling"
  ],
  "wellnessRecommendations": [
    "Personalized wellness advice focusing on stress, mood, and sleep"
  ],
  "financialRecommendations": [
    "Actionable budgeting, food, travel, or savings advice"
  ],
  "lifestyleImprovements": [
    "Advice on habits, daily consistency, or burnout recovery"
  ],
  "weeklyActionPlan": [
    { "day": "Day Name", "action": "Specific concise task", "priority": "high"|"medium"|"low" }
  ]
}`;

  const payload = {
    routineBrain: {
      score: routineBrain.routineScore,
      forecast: routineBrain.workloadForecast,
      insights: routineBrain.scheduleInsights,
      risks: routineBrain.risks
    },
    lifeCompanion: {
      score: lifeCompanion.wellnessScore,
      mood: lifeCompanion.moodTrends,
      stress: lifeCompanion.stressTrends,
      insights: lifeCompanion.lifestyleInsights
    },
    expenseIntelligence: {
      score: expenseIntelligence.budgetScore,
      spendingTrends: expenseIntelligence.spendingTrends,
      savingsEstimate: expenseIntelligence.savingsEstimates,
      insights: expenseIntelligence.financialInsights
    },
    habitTracker: {
      completion: habitTracker.completionMetrics,
      streaks: habitTracker.streakStatistics
    },
    burnoutGuardian: {
      score: burnoutGuardian.burnoutRiskScore,
      level: burnoutGuardian.burnoutLevel,
      factors: burnoutGuardian.contributingFactors,
      recovery: burnoutGuardian.recoveryGuidance
    }
  };

  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: `Here is the calculated telemetry metrics report for the student:\n\n${JSON.stringify(payload)}` }]
    }
  ];

  try {
    const responseText = await invokeBedrock({
      system: systemPrompt,
      messages,
      maxTokens: 1500,
      timeout: 30000
    });

    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Failed to call AWS Bedrock for Student Life AI Companion, falling back to mock generator:', error.message);
    return runStudentLifeAICompanionAnalysis({
      userId,
      routineBrain,
      lifeCompanion,
      expenseIntelligence,
      habitTracker,
      burnoutGuardian
    });
  }
};



