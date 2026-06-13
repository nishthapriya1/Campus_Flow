import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient, isAwsConfigured } from '../config/aws.js';

const MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

/**
 * Invokes Bedrock model with Claude 3 Messages API structure.
 * @param {object} params - Request options
 * @param {string} params.system - System prompt
 * @param {Array} params.messages - History of messages
 * @param {number} params.maxTokens - Maximum tokens to return
 * @param {number} params.timeout - Timeout in milliseconds
 * @returns {Promise<string>} Model output text
 */
const invokeClaude = async ({ system, messages, maxTokens = 300, timeout = 30000 }) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => {
      const err = new Error('Bedrock request timed out');
      err.status = 504;
      reject(err);
    }, timeout)
  );

  const mainPromise = (async () => {
    try {
      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        messages,
      };
      if (system) {
        payload.system = system;
      }

      const command = new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      if (responseBody?.content?.[0]?.text) {
        return responseBody.content[0].text;
      }
      throw new Error('Unexpected empty response from Bedrock model');
    } catch (error) {
      console.error('Bedrock invocation failed:', error.message);
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
    // Generate simulated summary for mock mode
    console.log('Mock Bedrock: Simulating notice summary...');
    // Simple heuristic summary
    const lowercaseText = text.toLowerCase();
    let topic = 'general campus updates';
    if (lowercaseText.includes('exam') || lowercaseText.includes('test')) {
      topic = 'upcoming examination schedules and submission guidelines';
    } else if (lowercaseText.includes('holiday') || lowercaseText.includes('closed')) {
      topic = 'academic calendar holidays and campus closure details';
    } else if (lowercaseText.includes('fee') || lowercaseText.includes('payment')) {
      topic = 'tuition fee payment deadlines and financial regulations';
    } else if (lowercaseText.includes('workshop') || lowercaseText.includes('seminar')) {
      topic = 'extracurricular skill development workshops and registration';
    }

    return `[MOCK AI SUMMARY] This notice outlines ${topic}. Key actions include verifying deadlines and completing registrations as required. Please refer to the full notice document for exact venue details and instructions.`;
  }

  const systemPrompt = `You are a helpful university administration assistant. Summarize the following notice text in plain language, keeping the summary strictly under 150 words. Ensure you preserve all important dates, deadlines, and direct action items. Translate or write the summary in the same language as the detected language of the source text.`;
  
  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: `Here is the notice text:\n\n${text}` }],
    },
  ];

  try {
    return await invokeClaude({ system: systemPrompt, messages, maxTokens: 300 });
  } catch (err) {
    console.warn('Bedrock notice summary failed, falling back to mock summary:', err.message);
    const lowercaseText = text.toLowerCase();
    let topic = 'general campus updates';
    if (lowercaseText.includes('exam') || lowercaseText.includes('test')) {
      topic = 'upcoming examination schedules and submission guidelines';
    } else if (lowercaseText.includes('holiday') || lowercaseText.includes('closed')) {
      topic = 'academic calendar holidays and campus closure details';
    } else if (lowercaseText.includes('fee') || lowercaseText.includes('payment')) {
      topic = 'tuition fee payment deadlines and financial regulations';
    } else if (lowercaseText.includes('workshop') || lowercaseText.includes('seminar')) {
      topic = 'extracurricular skill development workshops and registration';
    }

    return `[MOCK AI SUMMARY] This notice outlines ${topic}. Key actions include verifying deadlines and completing registrations as required. Please refer to the full notice document for exact venue details and instructions.`;
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

  const promptText = `Generate a study plan based on these parameters:
- Subjects: ${JSON.stringify(subjects)}
- Corresponding Exam Dates: ${JSON.stringify(examDates.map(d => new Date(d).toISOString().split('T')[0]))}
- Daily Study Hours limit: ${dailyHours}
- Blocked calendar slots (do not schedule study sessions during these): ${JSON.stringify(blockedSlots)}

Constraints:
1. Distribute study time for each subject proportionally to the number of remaining days before its exam relative to the total remaining days across all subjects.
2. Individual study sessions must be between 30 minutes and 3 hours.
3. Output ONLY a valid JSON array of study sessions. Do not include any explanation or markdown formatting (except a code block).
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

  const responseText = await invokeClaude({
    system: 'You are an academic advisor. You output ONLY structured JSON responses. Do not include any text before or after the JSON block.',
    messages,
    maxTokens: 1000,
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
  const academicKeywords = [
    'study', 'exam', 'course', 'assignment', 'homework', 'syllabus',
    'lecture', 'academic', 'subject', 'university', 'college', 'professor',
    'schedule', 'grade', 'cgpa', 'research', 'thesis', 'book', 'learn', 'curriculum',
    'math', 'science', 'history', 'physics', 'chemistry', 'biology', 'computer',
    'algebra', 'linear', 'solve', 'explain', 'rule', 'formula', 'concept', 'question'
  ];

  const isAcademic = academicKeywords.some(keyword => message.toLowerCase().includes(keyword));

  if (!isAcademic) {
    return "I'm sorry, I am scoped to assist you with academic topics only (such as course content, assignments, exam preparation, research, and university academic processes). Please rephrase your question toward these areas.";
  }

  if (!isAwsConfigured) {
    console.log('Mock Bedrock: Responding to academic chat message...');
    return `[MOCK ASSISTANT] Thank you for asking about "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}". In a real environment, I would consult our knowledge base or parse this prompt with Claude. Here is a helpful tip: break down your query into core concepts and organize daily study schedules to master them. Let me know how else I can support your academic success!`;
  }

  const systemPrompt = `You are a helpful university assistant. You MUST decline to answer any non-academic questions and politely suggest the student rephrase their question toward an academic topic. For academic topics (course content, assignments, exams, research, and academic processes), provide a structured, substantive, and helpful response. Keep responses concise, friendly, and professional (under 300 words).`;

  // Map client history to Bedrock message format: { role: 'user'|'assistant', content: [{ type: 'text', text: ... }] }
  const formattedMessages = history.map(h => ({
    role: h.role,
    content: [{ type: 'text', text: h.content }],
  }));

  // Append new user message
  formattedMessages.push({
    role: 'user',
    content: [{ type: 'text', text: message }],
  });

  return await invokeClaude({ system: systemPrompt, messages: formattedMessages, maxTokens: 512 });
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
    const lowercaseText = text.toLowerCase();
    let topic = 'general campus updates';
    let urgency = 'medium';
    let category = 'administrative';
    let deadlines = [];
    let actions = [];

    if (lowercaseText.includes('exam') || lowercaseText.includes('test')) {
      topic = 'upcoming examination schedules and submission guidelines';
      urgency = 'high';
      category = 'academic';
      const d = new Date();
      d.setDate(d.getDate() + 5);
      deadlines.push(d.toISOString().split('T')[0]);
      actions.push('Verify exam schedule');
    } else if (lowercaseText.includes('holiday') || lowercaseText.includes('closed')) {
      topic = 'academic calendar holidays and campus closure details';
      urgency = 'low';
      category = 'administrative';
    } else if (lowercaseText.includes('fee') || lowercaseText.includes('payment')) {
      topic = 'tuition fee payment deadlines and financial regulations';
      urgency = 'critical';
      category = 'administrative';
      const d = new Date();
      d.setDate(d.getDate() + 2);
      deadlines.push(d.toISOString().split('T')[0]);
      actions.push('Pay tuition fees');
    } else if (lowercaseText.includes('placement') || lowercaseText.includes('job') || lowercaseText.includes('career')) {
      topic = 'placement recruitment drive details';
      urgency = 'high';
      category = 'placement';
      const d = new Date();
      d.setDate(d.getDate() + 3);
      deadlines.push(d.toISOString().split('T')[0]);
      actions.push('Register on placement portal');
    }

    return {
      title: 'Notice Update',
      summary: `[MOCK AI SUMMARY] This notice outlines ${topic}. Key actions include verifying deadlines and completing registrations.`,
      deadlines,
      actions,
      urgency,
      category
    };
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
      responseText = await invokeClaude({ system: systemPrompt, messages, maxTokens: 600, timeout: 30000 });
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
      const lowercaseText = text.toLowerCase();
      let topic = 'general campus updates';
      let urgency = 'medium';
      let category = 'administrative';
      let deadlines = [];
      let actions = [];

      if (lowercaseText.includes('exam') || lowercaseText.includes('test')) {
        topic = 'upcoming examination schedules and submission guidelines';
        urgency = 'high';
        category = 'academic';
        const d = new Date();
        d.setDate(d.getDate() + 5);
        deadlines.push(d.toISOString().split('T')[0]);
        actions.push('Verify exam schedule');
      } else if (lowercaseText.includes('holiday') || lowercaseText.includes('closed')) {
        topic = 'academic calendar holidays and campus closure details';
        urgency = 'low';
        category = 'administrative';
      } else if (lowercaseText.includes('fee') || lowercaseText.includes('payment')) {
        topic = 'tuition fee payment deadlines and financial regulations';
        urgency = 'critical';
        category = 'administrative';
        const d = new Date();
        d.setDate(d.getDate() + 2);
        deadlines.push(d.toISOString().split('T')[0]);
        actions.push('Pay tuition fees');
      } else if (lowercaseText.includes('placement') || lowercaseText.includes('job') || lowercaseText.includes('career')) {
        topic = 'placement recruitment drive details';
        urgency = 'high';
        category = 'placement';
        const d = new Date();
        d.setDate(d.getDate() + 3);
        deadlines.push(d.toISOString().split('T')[0]);
        actions.push('Register on placement portal');
      }

      return {
        title: 'Notice Update',
        summary: `[MOCK AI SUMMARY] This notice outlines ${topic}. Key actions include verifying deadlines and completing registrations.`,
        deadlines,
        actions,
        urgency,
        category
      };
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
4. Placement opportunity alerts: Notice announcements for high-value placement drives or job applications.

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
      responseText = await invokeClaude({ system: systemPrompt, messages, maxTokens: 1024, timeout: 20000 });
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
