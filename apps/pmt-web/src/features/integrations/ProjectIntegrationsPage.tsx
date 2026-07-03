import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitHubIntegrationPanel } from './github/components/GitHubIntegrationPanel';
import { GitLabIntegrationPanel } from './gitlab/components/GitLabIntegrationPanel';
import { CalendarIntegrationPanel } from './calendar/components/CalendarIntegrationPanel';
import { TeamsIntegrationPanel } from './teams/components/TeamsIntegrationPanel';

export function ProjectIntegrationsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Project not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect external tools to your project for automated updates and collaboration.
          </p>
        </CardContent>
      </Card> */}

      <TeamsIntegrationPanel projectId={projectId} />
      <GitHubIntegrationPanel projectId={projectId} />
      <GitLabIntegrationPanel projectId={projectId} />
      <CalendarIntegrationPanel />
    </div>
  );
}

export default ProjectIntegrationsPage;
