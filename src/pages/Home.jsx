import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles, GraduationCap, Calendar, School, Target, ArrowRight,
  BookOpen, Users, Star, CheckCircle2 } from
"lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import RestartConfirmDialog from "@/components/RestartConfirmDialog";

const features = [
{
  icon: GraduationCap,
  title: "Smart Recommendations",
  description: "Classes, extracurriculars, and colleges matched to your interests"
},
{
  icon: Target,
  title: "Personalized Plans",
  description: "Multi-year or single-year roadmaps based on your grade level"
},
{
  icon: BookOpen,
  title: "Printable Guide",
  description: "Save your plan as a PDF to reference anytime"
}];


const stats = [
{ value: "100+", label: "Colleges Analyzed" },
{ value: "4 Years", label: "of Planning" },
{ value: "Free", label: "To Use" }];


export default function Home() {
  const [isRestartOpen, setIsRestartOpen] = useState(false);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["studentProfile"],
    queryFn: async () => {
      const isAuthenticated = await base44.auth.isAuthenticated();
      if (!isAuthenticated) return [];
      return base44.entities.StudentProfile.list("-created_date", 1);
    }
  });

  const profile = profiles?.[0];
  const hasStarted = !!profile;
  const hasPlan = profile?.plan_generated;

  const handleGetStarted = async () => {
    const isAuthenticated = await base44.auth.isAuthenticated();
    
    if (!isAuthenticated) {
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }
    
    if (hasPlan) {
      window.location.href = createPageUrl("ViewPlan");
    } else if (hasStarted) {
      window.location.href = createPageUrl("AIConversation");
    } else {
      window.location.href = createPageUrl("Onboarding");
    }
  };

  const handleRestart = () => {
    if (!profile) return;
    setIsRestartOpen(true);
  };

  const confirmRestart = async () => {
    setIsRestartOpen(false);
    await base44.entities.StudentProfile.delete(profile.id);
    window.location.href = createPageUrl("Onboarding");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: "1s" }} />
        
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center">

            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-6">

              <Sparkles className="w-4 h-4" />
              AI-Powered College Planning
            </motion.div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Your Path to College,{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Simplified</span>
            </h1>

            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
              Get a personalized, year-by-year roadmap to your dream college. Our AI 
              assistant helps you choose classes, activities, and programs that match your goals.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white h-14 px-8 text-lg rounded-xl shadow-lg shadow-indigo-500/25">

                {hasPlan ? "View My Plan" : hasStarted ? "Continue Planning" : "Start Your Journey"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              {hasStarted ? (
                <Button
                  onClick={handleRestart}
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg rounded-xl border-2">

                  Start Over
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg rounded-xl border-2">

                  See How It Works
                </Button>
              )}
            </div>

            {/* Stats */}
            <div className="flex justify-center gap-8 mt-16">
              {stats.map((stat, index) =>
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="text-center">

                  <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16">

          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Everything You Need to Plan for College
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto">
            Our AI assistant guides you through every step, from course selection to college applications.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {features.map((feature, index) =>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}>

              <Card className="h-full border-0 shadow-sm bg-gray-50 hover:shadow-md transition-shadow">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-8 h-8 text-gray-800" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-lg">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16">

            <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-gray-600">Three simple steps to your personalized college plan</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
            {
              step: "1",
              title: "Tell Us About Yourself",
              description: "Share your grades, interests, goals, and preferences in our quick onboarding form."
            },
            {
              step: "2",
              title: "Chat with AI",
              description: "Our AI asks follow-up questions to better understand your unique situation."
            },
            {
              step: "3",
              title: "Get Your Plan",
              description: "Receive a detailed, printable plan with courses, activities, and college recommendations."
            }].
            map((item, index) =>
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="text-center">

                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500">{item.description}</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-12 text-center text-white">

          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693471958a63318b535ee8db/7c5d68811_Yahli.png"
            alt="Yahli Lupesko"
            className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white/30 object-cover"
          />
          <h2 className="text-3xl font-bold mb-4">Why I created Pathway AI</h2>
          <p className="text-indigo-100 max-w-2xl mx-auto mb-2">
            I created Pathway AI to help level the playing field for students who do not have good access to college counseling or clear information about the application process. This project is my way of making guidance and planning tools available to anyone who needs them.
          </p>
          <p className="text-indigo-200 text-sm mb-8">— Yahli Lupesko, sophomore at Carlmont HS, California 🇺🇸</p>
          <Button
            onClick={handleGetStarted}
            size="lg"
            className="bg-white text-indigo-600 hover:bg-indigo-50 h-14 px-8 text-lg rounded-xl">

            {hasPlan ? "View My Plan" : "Get Started Now"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>
            Note: This tool provides AI-generated guidance. Always verify information 
            on official college websites before making decisions.
          </p>
        </div>
      </footer>

      <RestartConfirmDialog
        isOpen={isRestartOpen}
        onClose={() => setIsRestartOpen(false)}
        onConfirm={confirmRestart}
      />
    </div>);

}