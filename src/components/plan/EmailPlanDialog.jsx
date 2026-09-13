import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, X, Loader2, CheckCircle2 } from "lucide-react";

export default function EmailPlanDialog({ isOpen, onClose, userEmail, onSendEmail }) {
  const [email, setEmail] = useState("");
  const [previousEmails, setPreviousEmails] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    // Load previous emails from localStorage
    const saved = localStorage.getItem("emailPlanRecipients");
    if (saved) {
      try {
        setPreviousEmails(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved emails", e);
      }
    }
  }, []);

  const playSuccessSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // First tone
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.frequency.value = 1000;
    osc1.type = "sine";
    gain1.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
    osc1.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.15);
    
    // Second tone (higher pitch)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.value = 1300;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.15, audioContext.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
    osc2.start(audioContext.currentTime + 0.08);
    osc2.stop(audioContext.currentTime + 0.25);
  };

  const handleSend = async (recipientEmail) => {
    setIsSending(true);
    await onSendEmail(recipientEmail);
    
    // Save to previous emails if not already there
    if (recipientEmail !== userEmail && !previousEmails.includes(recipientEmail)) {
      const updated = [recipientEmail, ...previousEmails].slice(0, 5); // Keep max 5
      setPreviousEmails(updated);
      localStorage.setItem("emailPlanRecipients", JSON.stringify(updated));
    }
    
    setIsSending(false);
    setJustSent(true);
    playSuccessSound();
    setEmail("");
    
    // Close dialog after showing success
    setTimeout(() => {
      setJustSent(false);
      onClose();
    }, 1500);
  };

  const handleCustomEmail = () => {
    if (email.trim() && email.includes("@")) {
      handleSend(email.trim());
    }
  };

  const removeEmail = (emailToRemove) => {
    const updated = previousEmails.filter(e => e !== emailToRemove);
    setPreviousEmails(updated);
    localStorage.setItem("emailPlanRecipients", JSON.stringify(updated));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            Email Your Plan
          </DialogTitle>
          <DialogDescription>
            Send your personalized college plan to any email address
          </DialogDescription>
        </DialogHeader>

        {isSending || justSent ? (
          <div className="flex flex-col items-center justify-center py-12">
            {justSent ? (
              <>
                <CheckCircle2 className="w-16 h-16 text-green-600 mb-4" />
                <p className="text-lg font-medium text-gray-900">Email Sent!</p>
              </>
            ) : (
              <>
                <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-4" />
                <p className="text-lg font-medium text-gray-700">Sending email...</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {/* Quick Send to Registered Email */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Send to your email:</p>
              <Button
                onClick={() => handleSend(userEmail)}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send to {userEmail}
              </Button>
            </div>

            {/* Previous Recipients */}
            {previousEmails.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Recent recipients:</p>
                <div className="space-y-2">
                  {previousEmails.map((prevEmail) => (
                    <div key={prevEmail} className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleSend(prevEmail)}
                        className="flex-1 justify-start"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {prevEmail}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEmail(prevEmail)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Email Input */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Or enter a different email:</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCustomEmail();
                    }
                  }}
                />
                <Button
                  onClick={handleCustomEmail}
                  disabled={!email.trim() || !email.includes("@")}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}