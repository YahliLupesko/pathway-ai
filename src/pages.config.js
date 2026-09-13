import AIConversation from './pages/AIConversation';
import GeneratePlan from './pages/GeneratePlan';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import ViewPlan from './pages/ViewPlan';


export const PAGES = {
    "AIConversation": AIConversation,
    "GeneratePlan": GeneratePlan,
    "Home": Home,
    "Onboarding": Onboarding,
    "ViewPlan": ViewPlan,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};