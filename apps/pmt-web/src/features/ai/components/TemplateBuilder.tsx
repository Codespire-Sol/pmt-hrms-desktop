import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RefreshCw,
  Sparkles,
  FileText,
  Layers,
  Plus,
  Trash2,
  GripVertical,
  Settings,
  Copy,
  Download,
  CheckCircle2,
  Wand2,
  Calendar,
  Users,
  GitBranch,
  ListChecks,
  ClipboardList,
  BookOpen,
  Edit3,
  ChevronUp,
  ChevronDown,
  Lightbulb,
} from 'lucide-react';
import {
  useGenerateIssueTemplateEnhancedMutation,
  useGenerateEpicTemplateMutation,
  useGenerateChecklistTemplateMutation,
  useGenerateWorkflowTemplateMutation,
  useGenerateMeetingTemplateMutation,
  useCustomizeTemplateMutation,
  useSuggestTemplateFieldsMutation,
  useGenerateDocumentationTemplateMutation,
  useGetTemplateTypesQuery,
  useGetFieldTypesQuery,
} from '../aiApi';
import type {
  TemplateSection,
  TemplateFieldEnhanced,
  TemplateResponse,
  WorkflowTemplateResponse,
  ChecklistTemplateResponse,
  MeetingTemplateResponse,
} from '../types';

interface TemplateBuilderProps {
  projectContext?: Record<string, unknown>;
  onTemplateApply?: (template: TemplateResponse) => void;
  onWorkflowApply?: (workflow: WorkflowTemplateResponse) => void;
}

const TEMPLATE_TYPE_ICONS: Record<string, React.ReactNode> = {
  issue: <FileText className="h-4 w-4" />,
  epic: <Layers className="h-4 w-4" />,
  workflow: <GitBranch className="h-4 w-4" />,
  checklist: <ListChecks className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  documentation: <BookOpen className="h-4 w-4" />,
};

const FIELD_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Edit3 className="h-4 w-4" />,
  textarea: <FileText className="h-4 w-4" />,
  select: <ClipboardList className="h-4 w-4" />,
  multiselect: <ListChecks className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  user: <Users className="h-4 w-4" />,
};

export function TemplateBuilder({
  projectContext,
  onTemplateApply,
  onWorkflowApply,
}: TemplateBuilderProps) {
  const [activeTab, setActiveTab] = useState('generate');
  const [templateType, setTemplateType] = useState('issue');
  const [issueType, setIssueType] = useState('bug');
  const [epicType, setEpicType] = useState('feature');
  const [checklistType, setChecklistType] = useState('code_review');
  const [workflowType, setWorkflowType] = useState('agile');
  const [meetingType, setMeetingType] = useState('standup');
  const [docType, setDocType] = useState('technical_spec');
  const [duration, setDuration] = useState(60);
  const [description, setDescription] = useState('');
  const [generatedTemplate, setGeneratedTemplate] = useState<TemplateResponse | null>(null);
  const [workflowTemplate, setWorkflowTemplate] = useState<WorkflowTemplateResponse | null>(null);
  const [checklistTemplate, setChecklistTemplate] = useState<ChecklistTemplateResponse | null>(null);
  const [meetingTemplate, setMeetingTemplate] = useState<MeetingTemplateResponse | null>(null);
  const [suggestedFields, setSuggestedFields] = useState<Array<{ name: string; type: string; description: string }>>([]);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const [customizations, setCustomizations] = useState<Record<string, unknown>>({});

  const { data: templateTypes } = useGetTemplateTypesQuery();
  const { data: fieldTypes } = useGetFieldTypesQuery();
  const [generateIssue, { isLoading: isGeneratingIssue }] = useGenerateIssueTemplateEnhancedMutation();
  const [generateEpic, { isLoading: isGeneratingEpic }] = useGenerateEpicTemplateMutation();
  const [generateChecklist, { isLoading: isGeneratingChecklist }] = useGenerateChecklistTemplateMutation();
  const [generateWorkflow, { isLoading: isGeneratingWorkflow }] = useGenerateWorkflowTemplateMutation();
  const [generateMeeting, { isLoading: isGeneratingMeeting }] = useGenerateMeetingTemplateMutation();
  const [customizeTemplate, { isLoading: isCustomizing }] = useCustomizeTemplateMutation();
  const [suggestFields, { isLoading: isSuggesting }] = useSuggestTemplateFieldsMutation();
  const [generateDocs, { isLoading: isGeneratingDocs }] = useGenerateDocumentationTemplateMutation();

  const isLoading =
    isGeneratingIssue ||
    isGeneratingEpic ||
    isGeneratingChecklist ||
    isGeneratingWorkflow ||
    isGeneratingMeeting ||
    isGeneratingDocs;

  const handleGenerate = useCallback(async () => {
    try {
      switch (templateType) {
        case 'issue': {
          const result = await generateIssue({
            issueType,
            projectContext,
          }).unwrap();
          setGeneratedTemplate(result);
          break;
        }
        case 'epic': {
          const result = await generateEpic({
            epicType,
            projectContext,
          }).unwrap();
          setGeneratedTemplate(result);
          break;
        }
        case 'checklist': {
          const result = await generateChecklist({
            checklistType,
            context: description,
          }).unwrap();
          setChecklistTemplate(result);
          break;
        }
        case 'workflow': {
          const result = await generateWorkflow({
            workflowType,
            issueTypes: [issueType],
            projectContext,
          }).unwrap();
          setWorkflowTemplate(result);
          break;
        }
        case 'meeting': {
          const result = await generateMeeting({
            meetingType,
            durationMinutes: duration,
          }).unwrap();
          setMeetingTemplate(result);
          break;
        }
        case 'documentation': {
          const result = await generateDocs({
            docType,
            projectContext,
          }).unwrap();
          // Handle documentation template response
          break;
        }
      }
    } catch (error) {
      console.error('Failed to generate template:', error);
    }
  }, [
    templateType,
    issueType,
    epicType,
    checklistType,
    workflowType,
    meetingType,
    docType,
    duration,
    description,
    projectContext,
    generateIssue,
    generateEpic,
    generateChecklist,
    generateWorkflow,
    generateMeeting,
    generateDocs,
  ]);

  const handleSuggestFields = useCallback(async () => {
    if (!description.trim()) return;

    try {
      const result = await suggestFields({
        description,
        existingFields: generatedTemplate?.sections
          .flatMap((s) => s.fields.map((f) => f.name)) || [],
      }).unwrap();

      setSuggestedFields(result.suggestedFields);
    } catch (error) {
      console.error('Failed to suggest fields:', error);
    }
  }, [description, generatedTemplate, suggestFields]);

  const handleCustomize = useCallback(async () => {
    if (!generatedTemplate) return;

    try {
      const result = await customizeTemplate({
        template: generatedTemplate,
        customizations,
      }).unwrap();

      setGeneratedTemplate(result);
      setShowCustomizeDialog(false);
    } catch (error) {
      console.error('Failed to customize template:', error);
    }
  }, [generatedTemplate, customizations, customizeTemplate]);

  const handleApplyTemplate = useCallback(() => {
    if (generatedTemplate && onTemplateApply) {
      onTemplateApply(generatedTemplate);
    }
    if (workflowTemplate && onWorkflowApply) {
      onWorkflowApply(workflowTemplate);
    }
  }, [generatedTemplate, workflowTemplate, onTemplateApply, onWorkflowApply]);

  const handleCopyTemplate = useCallback(() => {
    const templateJson = JSON.stringify(
      generatedTemplate || workflowTemplate || checklistTemplate || meetingTemplate,
      null,
      2
    );
    navigator.clipboard.writeText(templateJson);
  }, [generatedTemplate, workflowTemplate, checklistTemplate, meetingTemplate]);

  const renderTemplateOptions = () => {
    switch (templateType) {
      case 'issue':
        return (
          <div className="space-y-2">
            <Label>Issue Type</Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug Report</SelectItem>
                <SelectItem value="feature">Feature Request</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="story">User Story</SelectItem>
                <SelectItem value="improvement">Improvement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 'epic':
        return (
          <div className="space-y-2">
            <Label>Epic Type</Label>
            <Select value={epicType} onValueChange={setEpicType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">Feature Epic</SelectItem>
                <SelectItem value="improvement">Improvement Epic</SelectItem>
                <SelectItem value="technical">Technical Epic</SelectItem>
                <SelectItem value="research">Research Epic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 'checklist':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Checklist Type</Label>
              <Select value={checklistType} onValueChange={setChecklistType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="code_review">Code Review</SelectItem>
                  <SelectItem value="deployment">Deployment</SelectItem>
                  <SelectItem value="release">Release</SelectItem>
                  <SelectItem value="security">Security Audit</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Context (optional)</Label>
              <Textarea
                placeholder="Describe the context for the checklist..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        );
      case 'workflow':
        return (
          <div className="space-y-2">
            <Label>Workflow Type</Label>
            <Select value={workflowType} onValueChange={setWorkflowType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agile">Agile/Scrum</SelectItem>
                <SelectItem value="kanban">Kanban</SelectItem>
                <SelectItem value="waterfall">Waterfall</SelectItem>
                <SelectItem value="support">Support Ticket</SelectItem>
                <SelectItem value="approval">Approval Flow</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 'meeting':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Meeting Type</Label>
              <Select value={meetingType} onValueChange={setMeetingType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standup">Daily Standup</SelectItem>
                  <SelectItem value="sprint_planning">Sprint Planning</SelectItem>
                  <SelectItem value="retrospective">Retrospective</SelectItem>
                  <SelectItem value="grooming">Backlog Grooming</SelectItem>
                  <SelectItem value="demo">Sprint Demo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                min={15}
                max={180}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>
        );
      case 'documentation':
        return (
          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technical_spec">Technical Spec</SelectItem>
                <SelectItem value="api_doc">API Documentation</SelectItem>
                <SelectItem value="user_guide">User Guide</SelectItem>
                <SelectItem value="runbook">Runbook</SelectItem>
                <SelectItem value="architecture">Architecture Doc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      default:
        return null;
    }
  };

  const renderGeneratedContent = () => {
    if (generatedTemplate) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{generatedTemplate.name}</h3>
              <p className="text-sm text-muted-foreground">{generatedTemplate.description}</p>
            </div>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleCopyTemplate}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy JSON</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Dialog open={showCustomizeDialog} onOpenChange={setShowCustomizeDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Customize Template</DialogTitle>
                    <DialogDescription>
                      Modify the template to fit your needs
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={customizations.name as string || generatedTemplate.name}
                        onChange={(e) =>
                          setCustomizations((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Add Tags (comma-separated)</Label>
                      <Input
                        placeholder="tag1, tag2, tag3"
                        onChange={(e) =>
                          setCustomizations((prev) => ({
                            ...prev,
                            tags: e.target.value.split(',').map((t) => t.trim()),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCustomizeDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCustomize} disabled={isCustomizing}>
                      {isCustomizing ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Apply
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {generatedTemplate.tags && generatedTemplate.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {generatedTemplate.tags.map((tag, idx) => (
                <Badge key={idx} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Accordion type="single" collapsible className="space-y-2">
            {generatedTemplate.sections.map((section, sidx) => (
              <AccordionItem
                key={sidx}
                value={String(sidx)}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{section.title}</span>
                    <Badge variant="outline">{section.fields.length} fields</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3 pl-8">
                    {section.description && (
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    )}
                    <div className="space-y-2">
                      {section.fields.map((field, fidx) => (
                        <div
                          key={fidx}
                          className="flex items-center justify-between p-2 border rounded bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            {FIELD_TYPE_ICONS[field.fieldType] || <Edit3 className="h-4 w-4" />}
                            <div>
                              <span className="font-medium">{field.label}</span>
                              {field.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                              {field.helpText && (
                                <p className="text-xs text-muted-foreground">
                                  {field.helpText}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">{field.fieldType}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {onTemplateApply && (
            <Button onClick={handleApplyTemplate} className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Apply Template
            </Button>
          )}
        </div>
      );
    }

    if (workflowTemplate) {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">{workflowTemplate.name}</h3>
            <p className="text-sm text-muted-foreground">{workflowTemplate.description}</p>
          </div>

          <div>
            <Label className="text-sm">Statuses ({workflowTemplate.statuses.length})</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {workflowTemplate.statuses.map((status, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  style={{ backgroundColor: status.color }}
                  className="text-white"
                >
                  {status.name}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm">
              Transitions ({workflowTemplate.transitions.length})
            </Label>
            <div className="space-y-2 mt-2">
              {workflowTemplate.transitions.slice(0, 5).map((trans, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{trans.fromStatus}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline">{trans.toStatus}</Badge>
                  <span className="text-muted-foreground ml-2">{trans.name}</span>
                </div>
              ))}
              {workflowTemplate.transitions.length > 5 && (
                <p className="text-sm text-muted-foreground">
                  +{workflowTemplate.transitions.length - 5} more transitions
                </p>
              )}
            </div>
          </div>

          {workflowTemplate.automationRules && workflowTemplate.automationRules.length > 0 && (
            <div>
              <Label className="text-sm">Automation Rules</Label>
              <div className="space-y-2 mt-2">
                {workflowTemplate.automationRules.map((rule, idx) => (
                  <div key={idx} className="p-2 border rounded bg-muted/30">
                    <span className="text-sm">{rule.name}</span>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {onWorkflowApply && (
            <Button onClick={handleApplyTemplate} className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Apply Workflow
            </Button>
          )}
        </div>
      );
    }

    if (checklistTemplate) {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">{checklistTemplate.name}</h3>
            <p className="text-sm text-muted-foreground">{checklistTemplate.description}</p>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Badge variant="outline">
              {checklistTemplate.categories.reduce(
                (acc, cat) => acc + (cat.items?.length || 0),
                0
              )}{' '}
              items
            </Badge>
            <span className="text-muted-foreground">
              Est. {checklistTemplate.estimatedTimeMinutes} minutes
            </span>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {checklistTemplate.categories.map((category, cidx) => (
              <AccordionItem
                key={cidx}
                value={String(cidx)}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="py-3">
                  <span>{category.name}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <ul className="space-y-2">
                    {category.items?.map((item, iidx) => (
                      <li key={iidx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-sm">{typeof item === 'string' ? item : item.text}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      );
    }

    if (meetingTemplate) {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">{meetingTemplate.name}</h3>
            <p className="text-sm text-muted-foreground">{meetingTemplate.description}</p>
          </div>

          <Badge variant="outline">{meetingTemplate.durationMinutes} minutes</Badge>

          <div>
            <Label className="text-sm">Agenda</Label>
            <div className="space-y-2 mt-2">
              {meetingTemplate.agenda.map((item, idx) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="outline">{item.durationMinutes} min</Badge>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {meetingTemplate.preparation && meetingTemplate.preparation.length > 0 && (
            <div>
              <Label className="text-sm">Preparation</Label>
              <ul className="mt-2 space-y-1">
                {meetingTemplate.preparation.map((prep, idx) => (
                  <li key={idx} className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {prep}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meetingTemplate.followUpTemplate && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm">Follow-up Template</Label>
              <p className="text-sm mt-1">{meetingTemplate.followUpTemplate}</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-center py-12 text-muted-foreground">
        <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select a template type and click Generate to create a template</p>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-purple-500" />
          AI Template Builder
        </CardTitle>
        <CardDescription>
          Generate dynamic templates for issues, workflows, checklists, and more
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger
              value="preview"
              disabled={
                !generatedTemplate &&
                !workflowTemplate &&
                !checklistTemplate &&
                !meetingTemplate
              }
            >
              Preview
            </TabsTrigger>
          </TabsList>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-4">
            <div className="space-y-2">
              <Label>Template Type</Label>
              <Select value={templateType} onValueChange={setTemplateType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateTypes?.types?.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {TEMPLATE_TYPE_ICONS[type.value] || <FileText className="h-4 w-4" />}
                        {type.label}
                      </div>
                    </SelectItem>
                  )) || (
                    <>
                      <SelectItem value="issue">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Issue Template
                        </div>
                      </SelectItem>
                      <SelectItem value="epic">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          Epic Template
                        </div>
                      </SelectItem>
                      <SelectItem value="workflow">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          Workflow Template
                        </div>
                      </SelectItem>
                      <SelectItem value="checklist">
                        <div className="flex items-center gap-2">
                          <ListChecks className="h-4 w-4" />
                          Checklist Template
                        </div>
                      </SelectItem>
                      <SelectItem value="meeting">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Meeting Template
                        </div>
                      </SelectItem>
                      <SelectItem value="documentation">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Documentation Template
                        </div>
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {renderTemplateOptions()}

            {/* Field Suggestions */}
            {(templateType === 'issue' || templateType === 'epic') && (
              <div className="space-y-2">
                <Label>Describe your needs (for field suggestions)</Label>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Describe what kind of information you need to capture..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleSuggestFields}
                    disabled={!description.trim() || isSuggesting}
                  >
                    {isSuggesting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lightbulb className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {suggestedFields.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <Label className="text-xs text-muted-foreground">Suggested Fields</Label>
                    {suggestedFields.map((field, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 border rounded text-sm"
                      >
                        <div>
                          <span className="font-medium">{field.name}</span>
                          <p className="text-xs text-muted-foreground">{field.description}</p>
                        </div>
                        <Badge variant="outline">{field.type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Template
            </Button>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <ScrollArea className="h-[500px]">{renderGeneratedContent()}</ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default TemplateBuilder;
