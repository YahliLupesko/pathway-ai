import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, GraduationCap, Sun, School, FileText,
  Printer, MessageCircle, ArrowLeft, Sparkles, ClipboardList, AlertTriangle, Mail
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import toast from "react-hot-toast";

import YearlyPlanCard from "@/components/plan/YearlyPlanCard";
import CollegeCard from "@/components/plan/CollegeCard";
import ActionItemsList from "@/components/plan/ActionItemsList";
import SummerProgramsList from "@/components/plan/SummerProgramsList";
import EmailPlanDialog from "@/components/plan/EmailPlanDialog";

export default function ViewPlan() {
  const printRef = useRef();
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["studentProfile"],
    queryFn: () => base44.entities.StudentProfile.list("-created_date", 1)
  });

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me()
  });

  const profile = profiles?.[0];
  const plan = profile?.plan_data;

  const handleSendEmail = async (recipientEmail) => {
    try {
      await base44.functions.invoke('emailPlan', {
        recipientEmail,
        planData: plan,
        profileData: profile
      });
      toast.success(`Plan sent to ${recipientEmail}!`);
    } catch (error) {
      toast.error('Failed to send email');
      console.error(error);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>My College Plan</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #4F46E5; margin-bottom: 8px; }
            h2 { color: #1F2937; border-bottom: 2px solid #E5E7EB; padding-bottom: 8px; margin-top: 32px; }
            h3 { color: #374151; margin-top: 24px; }
            .summary { background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0; }
            .section { margin-bottom: 24px; }
            .badge { display: inline-block; background: #EEF2FF; color: #4F46E5; padding: 4px 12px; border-radius: 16px; font-size: 12px; margin: 4px; }
            .college { border: 1px solid #E5E7EB; padding: 16px; border-radius: 8px; margin: 12px 0; }
            .reach { border-left: 4px solid #F43F5E; }
            .match { border-left: 4px solid #10B981; }
            .safety { border-left: 4px solid #3B82F6; }
            ul { padding-left: 20px; }
            li { margin: 8px 0; }
            .disclaimer { background: #FEF3C7; padding: 12px; border-radius: 8px; font-size: 12px; margin-top: 32px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>🎓 My College Plan</h1>
          <p style="color:#6B7280;">Generated for ${profile?.grade_level} Grade Student</p>
          
          <div class="summary">
            <strong>Plan Summary</strong>
            <p>${plan?.summary || ""}</p>
          </div>

          <h2>📅 Year-by-Year Roadmap</h2>
          ${plan?.yearly_plans?.map(year => `
            <div class="section">
              <h3>${year.grade} Grade (${year.year})</h3>
              <p><strong>Recommended Courses:</strong></p>
              <div>${year.courses?.map(c => `<span class="badge">${c}</span>`).join("") || ""}</div>
              <p><strong>Activities:</strong></p>
              <ul>${year.activities?.map(a => `<li>${a}</li>`).join("") || ""}</ul>
              <p><strong>Milestones:</strong></p>
              <ul>${year.milestones?.map(m => `<li>${m}</li>`).join("") || ""}</ul>
            </div>
          `).join("") || ""}

          <h2>🏫 College Recommendations</h2>
          ${plan?.college_recommendations?.map(c => `
            <div class="college ${c.type}">
              <strong>${c.name}</strong> <span class="badge">${c.type}</span>
              <p style="margin:8px 0;color:#6B7280;">${c.location} • ${c.estimated_cost}</p>
              <p>${c.why_good_fit}</p>
              ${c.notable_programs?.length ? `<p><strong>Notable Programs:</strong> ${c.notable_programs.join(", ")}</p>` : ""}
            </div>
          `).join("") || ""}

          <h2>☀️ Summer Programs</h2>
          ${plan?.summer_programs?.map(p => `
            <div class="section">
              <strong>${p.name}</strong>
              <p>${p.description}</p>
              <p style="color:#6B7280;font-size:14px;">${p.timing} • ${p.cost}</p>
            </div>
          `).join("") || ""}

          <h2>✅ Next Steps</h2>
          <ul>
            ${plan?.immediate_actions?.map(a => `<li><strong>[${a.priority}]</strong> ${a.action} - ${a.deadline}</li>`).join("") || ""}
          </ul>

          <div class="disclaimer">
            <strong>⚠️ Important Note:</strong> This plan is AI-generated guidance. College-specific information 
            (admission requirements, costs, deadlines) should be verified on official college websites. 
            Financial aid and scholarship opportunities may vary.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your plan...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Plan Generated Yet</h2>
            <p className="text-gray-500 mb-6">Complete the onboarding to generate your personalized college plan.</p>
            <Button onClick={() => window.location.href = createPageUrl("Onboarding")} className="bg-indigo-600 hover:bg-indigo-700">
              Start Planning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.href = createPageUrl("AIConversation")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                My College Plan
              </h1>
              <p className="text-xs text-gray-500">{profile.grade_level} Grade Student</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.location.href = createPageUrl("AIConversation")}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat More
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEmailDialogOpen(true)}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email Plan
            </Button>
            <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700">
              <Printer className="w-4 h-4 mr-2" />
              Print Plan
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8" ref={printRef}>
        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 mb-8 text-white"
        >
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Your Personalized Summary
          </h2>
          <p className="text-indigo-100 leading-relaxed">{plan.summary}</p>
        </motion.div>

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Important:</strong> This plan is AI-generated guidance. Always verify college-specific 
            information (requirements, costs, deadlines) on official college websites.
          </p>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="roadmap" className="space-y-6">
          <TabsList className="bg-white shadow-sm border border-gray-100 p-1 rounded-xl">
            <TabsTrigger value="roadmap" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              Roadmap
            </TabsTrigger>
            <TabsTrigger value="colleges" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <School className="w-4 h-4 mr-2" />
              Colleges
            </TabsTrigger>
            <TabsTrigger value="summer" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Sun className="w-4 h-4 mr-2" />
              Summer
            </TabsTrigger>
            <TabsTrigger value="actions" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <ClipboardList className="w-4 h-4 mr-2" />
              Next Steps
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roadmap" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {plan.yearly_plans?.map((yearPlan, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <YearlyPlanCard yearPlan={yearPlan} />
                </motion.div>
              ))}
            </div>

            {plan.test_prep_plan && (
              <Card className="border-0 shadow-lg shadow-gray-100">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-indigo-600" />
                    Test Prep Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Recommended Tests</p>
                      <div className="flex flex-wrap gap-2">
                        {plan.test_prep_plan.recommended_tests?.map((test, i) => (
                          <Badge key={i} className="bg-indigo-100 text-indigo-700">{test}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Timeline</p>
                      <p className="text-gray-700">{plan.test_prep_plan.timeline}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Target Scores</p>
                      <p className="text-gray-700">{plan.test_prep_plan.target_scores}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="colleges">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plan.college_recommendations?.map((college, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <CollegeCard college={college} />
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="summer">
            <div className="max-w-2xl">
              <SummerProgramsList programs={plan.summer_programs} />
            </div>
          </TabsContent>

          <TabsContent value="actions">
            <div className="max-w-2xl">
              <ActionItemsList actions={plan.immediate_actions} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EmailPlanDialog
        isOpen={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
        userEmail={user?.email}
        onSendEmail={handleSendEmail}
      />
    </div>
  );
}