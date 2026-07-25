import { useToast } from "@/hooks/use-toast";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';

// Pages
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import Keywords from '@/pages/Keywords';
import Articles from '@/pages/Articles';
import ArticleEditor from '@/pages/ArticleEditor';
import Workflow from '@/pages/Workflow';
import Publishing from '@/pages/Publishing';
import WordPress from '@/pages/WordPress';
import Schedules from '@/pages/Schedules';
import ApiManager from '@/pages/ApiManager';
import Analytics from '@/pages/Analytics';
import Settings from '@/pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/keywords" component={Keywords} />
        <Route path="/articles" component={Articles} />
        <Route path="/articles/:id" component={ArticleEditor} />
        <Route path="/workflow" component={Workflow} />
        <Route path="/publishing" component={Publishing} />
        <Route path="/wordpress" component={WordPress} />
        <Route path="/schedules" component={Schedules} />
        <Route path="/api-manager" component={ApiManager} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="humanseo-theme">
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
