import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipientEmail, planData, profileData } = await req.json();

    if (!recipientEmail || !planData) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build email HTML content
    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: #f9fafb; }
            .container { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            h1 { color: #4F46E5; margin-bottom: 8px; }
            .summary { background: #EEF2FF; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #4F46E5; }
            h2 { color: #1F2937; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; margin-top: 32px; }
            h3 { color: #374151; margin-top: 24px; }
            .badge { display: inline-block; background: #EEF2FF; color: #4F46E5; padding: 4px 12px; border-radius: 16px; font-size: 12px; margin: 4px; }
            .college { border: 1px solid #E5E7EB; padding: 16px; border-radius: 8px; margin: 12px 0; }
            .reach { border-left: 4px solid #F43F5E; }
            .match { border-left: 4px solid #10B981; }
            .safety { border-left: 4px solid #3B82F6; }
            ul { padding-left: 20px; }
            li { margin: 8px 0; }
            .disclaimer { background: #FEF3C7; padding: 12px; border-radius: 8px; font-size: 12px; margin-top: 32px; border-left: 4px solid #F59E0B; }
            .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎓 Your College Plan</h1>
            <p style="color:#6B7280;">Generated for ${profileData?.grade_level || ''} Grade Student</p>
            
            <div class="summary">
              <strong>Plan Summary</strong>
              <p>${planData.summary || ''}</p>
            </div>

            <h2>📅 Year-by-Year Roadmap</h2>
            ${planData.yearly_plans?.map(year => `
              <div style="margin-bottom: 24px;">
                <h3>${year.grade} Grade (${year.year})</h3>
                <p><strong>Recommended Courses:</strong></p>
                <div>${year.courses?.map(c => `<span class="badge">${c}</span>`).join('') || ''}</div>
                <p><strong>Activities:</strong></p>
                <ul>${year.activities?.map(a => `<li>${a}</li>`).join('') || ''}</ul>
                <p><strong>Milestones:</strong></p>
                <ul>${year.milestones?.map(m => `<li>${m}</li>`).join('') || ''}</ul>
              </div>
            `).join('') || ''}

            <h2>🏫 College Recommendations</h2>
            ${planData.college_recommendations?.map(c => `
              <div class="college ${c.type}">
                <strong>${c.name}</strong> <span class="badge">${c.type}</span>
                <p style="margin:8px 0;color:#6B7280;">${c.location} • ${c.estimated_cost}</p>
                <p>${c.why_good_fit}</p>
                ${c.notable_programs?.length ? `<p><strong>Notable Programs:</strong> ${c.notable_programs.join(', ')}</p>` : ''}
              </div>
            `).join('') || ''}

            <h2>☀️ Summer Programs</h2>
            ${planData.summer_programs?.map(p => `
              <div style="margin-bottom: 16px;">
                <strong>${p.name}</strong>
                <p>${p.description}</p>
                <p style="color:#6B7280;font-size:14px;">${p.timing} • ${p.cost}</p>
              </div>
            `).join('') || ''}

            <h2>✅ Next Steps</h2>
            <ul>
              ${planData.immediate_actions?.map(a => `<li><strong>[${a.priority}]</strong> ${a.action} - ${a.deadline}</li>`).join('') || ''}
            </ul>

            <div class="disclaimer">
              <strong>⚠️ Important Note:</strong> This plan is AI-generated guidance. College-specific information 
              (admission requirements, costs, deadlines) should be verified on official college websites. 
              Financial aid and scholarship opportunities may vary.
            </div>

            <div class="footer">
              <p>Powered by Pathway AI</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    await base44.integrations.Core.SendEmail({
      from_name: "College Planning Assistant",
      to: recipientEmail,
      subject: `🎓 Your Personalized College Plan - ${profileData?.grade_level || ''} Grade`,
      body: emailHTML
    });

    return Response.json({ success: true, message: `Plan sent to ${recipientEmail}` });
  } catch (error) {
    console.error('Email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});