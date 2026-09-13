import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, FileText, Download, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";

const GENERATION_STEPS = [
  "Analyzing your profile...",
  "Looking up your school's course catalog...",
  "Building realistic course recommendations...",
  "Researching matching colleges...",
  "Finding summer programs...",
  "Creating your personalized roadmap..."
];

export default function GeneratePlan() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [planData, setPlanData] = useState(null, false);

  const { data: profiles } = useQuery({
    queryKey: ["studentProfile"],
    queryFn: () => base44.entities.StudentProfile.list("-created_date", 1)
  });

  const profile = profiles?.[0];

  useEffect(() => {
    if (profile && !profile.plan_data && isGenerating) {
      generatePlan();
    } else if (profile?.plan_data) {
      setPlanData(profile.plan_data);
      setIsGenerating(false);
      setCurrentStep(GENERATION_STEPS.length);
    }
  }, [profile]);

  useEffect(() => {
    if (isGenerating && currentStep < GENERATION_STEPS.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isGenerating]);

  const generatePlan = async () => {
    const isMultiYear = ["9th", "10th", "11th"].includes(profile.grade_level);
    const yearsRemaining = {
      "9th": 4,
      "10th": 3,
      "11th": 2,
      "12th": 1
    }[profile.grade_level];

    const conversationSummary = profile.conversation_history
      ?.map(m => `${m.role}: ${m.content}`)
      .join("\n") || "";

    const currentClasses = profile.current_classes?.join(", ") || "Not specified";
    const schoolInfo = profile.school_name 
      ? `${profile.school_name}${profile.district ? ` (${profile.district})` : ""}${profile.school_type ? ` - ${profile.school_type}` : ""}`
      : "Not specified";

    const prompt = `You are an expert college counselor. Create a detailed ${isMultiYear ? "multi-year" : "one-year"} college preparation plan for this student.

STUDENT PROFILE:
- Current Grade: ${profile.grade_level}
- GPA: ${profile.gpa}
- Location: ${profile.location_preference || "Flexible"}
- Academic Interests: ${profile.interests?.join(", ") || "Undecided"}
- Career Goals: ${profile.goals || "Exploring options"}
- Budget Preference: ${profile.budget_range || "Flexible"}
- Current Activities: ${profile.extracurriculars?.join(", ") || "Looking to get involved"}
- Test Scores: SAT: ${profile.test_scores?.sat || "Not taken"}, ACT: ${profile.test_scores?.act || "Not taken"}

SCHOOL INFORMATION:
- High School: ${schoolInfo}
- Current/Completed Classes: ${currentClasses}

CONVERSATION INSIGHTS:
${conversationSummary}

STEP 1 — RESEARCH THE SCHOOL'S ACTUAL COURSE CATALOG (MANDATORY):
You MUST use web search to find the real course catalog for ${profile.school_name || "the student's school"}${profile.district ? ` in ${profile.district}` : ""}. Search for things like "${profile.school_name || ""} course catalog", "${profile.school_name || ""} curriculum guide", "${profile.district || ""} high school course offerings", or the school's counseling/academic page. 
Before you recommend ANY course, you must have found it in the school's or district's actual published catalog. 
- List the real electives, AP/honors courses, and core courses the school offers.
- If you cannot find the exact school's catalog, search other schools in ${profile.district || "the same district"} and use their catalogs as a reference for what is regionally available — but prefer the student's actual school.
- If after thorough searching you genuinely cannot find the school's or district's course catalog, do NOT leave courses blank. Instead, make thoughtful suggestions based on the standard high school curriculum typical of a ${profile.school_type || "public"} school in the student's area, clearly noting in the summary that the school's catalog could not be found and these are general recommendations the student should verify with their counselor. Still follow proper course sequences and avoid recommending courses the student has already completed.

STEP 2 — BUILD THE PLAN USING ONLY THOSE REAL COURSES:
1. Recommended courses for ${isMultiYear ? "each remaining year" : "senior year"} — every course MUST be one you found in the school's/district's actual catalog. Include real electives from the catalog, not generic guesses.
2. Follow proper course sequences for ALL core subjects:
   - Math: Algebra 1 → Geometry → Algebra 2 → Pre-Calculus → Calculus / AP Calc
   - Science: Biology → Chemistry → Physics → AP Sciences (Bio, Chem, Physics, Environmental)
   - English: English 9 → English 10 → English 11 → English 12 / AP English Lang / AP English Lit
   - Social Studies: World History → US History → Government/Economics → AP History (US, World, Euro, Govt)
   - Foreign Language: Level 1 → Level 2 → Level 3 → Level 4 / AP Language
   A student currently in Algebra 1 should NOT be told to take AP Calculus BC next. A student in Spanish 1 should NOT be told to take AP Spanish. A student in English 10 should NOT be told to take AP English Literature.
3. RESPECT ALL PREREQUISITES AND COURSE PATHWAYS — this is critical. When you look up the school's catalog, also note the listed prerequisites for each course. NEVER recommend a course unless the student has already completed (or is on track to complete) its prerequisites. For example:
   - Do not recommend AP Chemistry without Chemistry (and often Algebra 2).
   - Do not recommend AP Physics without Physics and the required math.
   - Do not recommend Calculus without Pre-Calculus.
   - Do not recommend AP Language/Lit without the prior English course.
   - Do not recommend a Level 3 or 4 / AP foreign language without the prior levels.
   - Do not recommend honors or advanced electives that list prerequisites the student hasn't met.
   This applies to electives too — many electives (e.g., advanced art, engineering, journalism 2, AP electives) have prerequisite intro courses. Only recommend them if the student has the prerequisite or if the prerequisite is included earlier in the plan.
4. Consider what the student has ALREADY completed. Do not recommend courses they've already taken.
5. Recommended courses for each year must build logically on what was taken the previous year, with every prerequisite satisfied before the next course.
6. If the student is in ${profile.grade_level} grade, only recommend courses for ${isMultiYear ? `grades ${profile.grade_level} through 12th` : "12th grade"} — not earlier grades they've already passed.

STEP 3 — COMPLETE THE REST OF THE PLAN:
1. Extracurricular activities to pursue or continue
2. Summer program recommendations (with realistic options)
3. 8-10 college recommendations that match their profile, goals, and budget (mix of reach, match, safety)
4. Timeline milestones for testing, applications, etc.
5. Specific action items for the next 3 months

CRITICAL: The course recommendations are the most important part. Every course name must come from the school's or district's real, web-searched catalog — never guessed or generic. Include a mix of reach, match, and safety colleges, and consider financial aid/scholarships based on budget preference.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini_3_1_pro",
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Brief personalized summary of the plan" },
          yearly_plans: {
            type: "array",
            items: {
              type: "object",
              properties: {
                year: { type: "string" },
                grade: { type: "string" },
                courses: { type: "array", items: { type: "string" } },
                activities: { type: "array", items: { type: "string" } },
                milestones: { type: "array", items: { type: "string" } }
              }
            }
          },
          summer_programs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                timing: { type: "string" },
                cost: { type: "string" }
              }
            }
          },
          college_recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string", enum: ["reach", "match", "safety"] },
                location: { type: "string" },
                estimated_cost: { type: "string" },
                why_good_fit: { type: "string" },
                notable_programs: { type: "array", items: { type: "string" } }
              }
            }
          },
          immediate_actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string" },
                deadline: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] }
              }
            }
          },
          test_prep_plan: {
            type: "object",
            properties: {
              recommended_tests: { type: "array", items: { type: "string" } },
              timeline: { type: "string" },
              target_scores: { type: "string" }
            }
          }
        }
      }
    });

    setPlanData(response);
    await base44.entities.StudentProfile.update(profile.id, {
      plan_data: response,
      plan_generated: true
    });
    setIsGenerating(false);
  };

  const handleViewPlan = () => {
    window.location.href = createPageUrl("ViewPlan");
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    setCurrentStep(0);
    setPlanData(null);
    await base44.entities.StudentProfile.update(profile.id, {
      plan_data: null,
      plan_generated: false
    });
    generatePlan();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8"
        >
          <div className="text-center mb-8">
            <motion.div
              animate={{ rotate: isGenerating ? 360 : 0 }}
              transition={{ duration: 2, repeat: isGenerating ? Infinity : 0, ease: "linear" }}
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-gray-900">
              {isGenerating ? "Creating Your Plan" : "Your Plan is Ready!"}
            </h1>
            <p className="text-gray-500 mt-2">
              {isGenerating
                ? "Our AI is building a personalized roadmap just for you"
                : "We've created a customized college preparation plan"}
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {GENERATION_STEPS.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ 
                  opacity: index <= currentStep ? 1 : 0.4,
                  x: 0 
                }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    index < currentStep
                      ? "bg-green-500"
                      : index === currentStep && isGenerating
                      ? "bg-indigo-500"
                      : "bg-gray-200"
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : index === currentStep && isGenerating ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    index <= currentStep ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  {step}
                </span>
              </motion.div>
            ))}
          </div>

          {!isGenerating && planData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <Button
                onClick={handleViewPlan}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 h-12 text-base"
              >
                <FileText className="w-5 h-5 mr-2" />
                View My College Plan
              </Button>
              
              <Button
                onClick={handleRegenerate}
                variant="outline"
                className="w-full h-12"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Plan
              </Button>
            </motion.div>
          )}
        </motion.div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Note: This plan is AI-generated guidance. Always verify college-specific 
          information on official websites.
        </p>
      </div>
    </div>
  );
}