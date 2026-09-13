import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

export default function StepBasicInfo({ data, setData }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">Let's get to know you</h2>
        <p className="text-gray-500 mt-2">Tell us about your current academic situation</p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="grade" className="text-sm font-medium text-gray-700">
            What grade are you in?
          </Label>
          <Select
            value={data.grade_level || ""}
            onValueChange={(value) => setData({ ...data, grade_level: value })}
          >
            <SelectTrigger className="h-12 bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500">
              <SelectValue placeholder="Select your grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="9th">9th Grade (Freshman)</SelectItem>
              <SelectItem value="10th">10th Grade (Sophomore)</SelectItem>
              <SelectItem value="11th">11th Grade (Junior)</SelectItem>
              <SelectItem value="12th">12th Grade (Senior)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gpa" className="text-sm font-medium text-gray-700">
            Current GPA (on 4.0 scale)
          </Label>
          <Input
            id="gpa"
            type="number"
            step="0.1"
            min="0"
            max="4.0"
            placeholder="e.g., 3.5"
            value={data.gpa || ""}
            onChange={(e) => setData({ ...data, gpa: parseFloat(e.target.value) || "" })}
            className="h-12 bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-sm font-medium text-gray-700">
            Where do you live? (State or Region)
          </Label>
          <Input
            id="location"
            placeholder="e.g., California, Northeast, etc."
            value={data.location_preference || ""}
            onChange={(e) => setData({ ...data, location_preference: e.target.value })}
            className="h-12 bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="school_name" className="text-sm font-medium text-gray-700">
            What high school do you attend?
          </Label>
          <Input
            id="school_name"
            placeholder="e.g., Lincoln High School"
            value={data.school_name || ""}
            onChange={(e) => setData({ ...data, school_name: e.target.value })}
            className="h-12 bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="district" className="text-sm font-medium text-gray-700">
              School District
            </Label>
            <Input
              id="district"
              placeholder="e.g., San Jose Unified"
              value={data.district || ""}
              onChange={(e) => setData({ ...data, district: e.target.value })}
              className="h-12 bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school_type" className="text-sm font-medium text-gray-700">
              School Type
            </Label>
            <Select
              value={data.school_type || ""}
              onValueChange={(value) => setData({ ...data, school_type: value })}
            >
              <SelectTrigger className="h-12 bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="charter">Charter</SelectItem>
                <SelectItem value="homeschool">Homeschool</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </motion.div>
  );
}