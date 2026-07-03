import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RefreshCw,
  FileText,
  Copy,
  Check,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { useGenerateIssueTemplateMutation } from '../aiApi';
import type { GenerateTemplateResponse, TemplateField } from '../types';

interface AITemplateGeneratorProps {
  onTemplateApply?: (title: string, description: string, acceptanceCriteria: string[]) => void;
  projectContext?: Record<string, unknown>;
}

const ISSUE_TYPES = [
  { value: 'bug', label: 'Bug', description: 'A defect or problem that needs fixing' },
  { value: 'task', label: 'Task', description: 'A discrete piece of work' },
  { value: 'story', label: 'User Story', description: 'A feature from user perspective' },
  { value: 'epic', label: 'Epic', description: 'A large feature spanning multiple stories' },
];

export function AITemplateGenerator({
  onTemplateApply,
  projectContext,
}: AITemplateGeneratorProps) {
  const [issueType, setIssueType] = useState<string>('task');
  const [template, setTemplate] = useState<GenerateTemplateResponse | null>(null);
  const [filledTitle, setFilledTitle] = useState('');
  const [filledDescription, setFilledDescription] = useState('');
  const [filledCriteria, setFilledCriteria] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const [generateTemplate, { isLoading }] = useGenerateIssueTemplateMutation();

  const handleGenerateTemplate = useCallback(async () => {
    try {
      const result = await generateTemplate({
        issueType,
        projectContext,
      }).unwrap();

      setTemplate(result);
      setFilledTitle(result.titleTemplate);
      setFilledDescription(result.descriptionTemplate);
      setFilledCriteria(result.acceptanceCriteriaTemplate);
      setFieldValues({});
    } catch (error) {
      console.error('Failed to generate template:', error);
    }
  }, [issueType, projectContext, generateTemplate]);

  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  const handleApplyTemplate = useCallback(() => {
    if (onTemplateApply) {
      onTemplateApply(filledTitle, filledDescription, filledCriteria);
    }
  }, [filledTitle, filledDescription, filledCriteria, onTemplateApply]);

  const handleCopy = useCallback(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const renderFieldInput = (field: TemplateField) => {
    return (
      <div key={field.name} className="space-y-1">
        <div className="flex items-center gap-2">
          <Label htmlFor={field.name} className="text-sm">
            {field.label}
            {field.required && <span className="text-destructive">*</span>}
          </Label>
          {field.helpText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>{field.helpText}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Input
          id={field.name}
          placeholder={field.placeholder}
          value={fieldValues[field.name] || ''}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
        />
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-500" />
          AI Issue Template Generator
        </CardTitle>
        <CardDescription>
          Generate structured templates for different issue types
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Issue Type Selection */}
        <div className="space-y-2">
          <Label>Issue Type</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ISSUE_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={issueType === type.value ? 'default' : 'outline'}
                className="flex flex-col items-start h-auto p-3"
                onClick={() => setIssueType(type.value)}
              >
                <span className="font-medium">{type.label}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {type.description}
                </span>
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={handleGenerateTemplate} disabled={isLoading}>
          {isLoading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Generate Template
        </Button>

        {/* Generated Template */}
        {template && (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium capitalize">{template.issueType} Template</h3>
              <Badge variant="secondary">{template.issueType}</Badge>
            </div>

            <Separator />

            <Accordion type="multiple" defaultValue={['title', 'description', 'fields']}>
              {/* Title Template */}
              <AccordionItem value="title">
                <AccordionTrigger>Title Template</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={filledTitle}
                      onChange={(e) => setFilledTitle(e.target.value)}
                      placeholder="Issue title"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(filledTitle, 'title')}
                    >
                      {copied === 'title' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Replace [PLACEHOLDERS] with actual values
                  </p>
                </AccordionContent>
              </AccordionItem>

              {/* Description Template */}
              <AccordionItem value="description">
                <AccordionTrigger>Description Template</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Textarea
                      value={filledDescription}
                      onChange={(e) => setFilledDescription(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(filledDescription, 'description')}
                    >
                      {copied === 'description' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Custom Fields */}
              {template.fields.length > 0 && (
                <AccordionItem value="fields">
                  <AccordionTrigger>
                    Custom Fields ({template.fields.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      {template.fields.map((field) => renderFieldInput(field))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Acceptance Criteria */}
              {template.acceptanceCriteriaTemplate.length > 0 && (
                <AccordionItem value="criteria">
                  <AccordionTrigger>
                    Acceptance Criteria Templates ({template.acceptanceCriteriaTemplate.length})
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {template.acceptanceCriteriaTemplate.map((criterion, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="flex-1">
                          <Input
                            value={filledCriteria[index] || criterion}
                            onChange={(e) => {
                              const newCriteria = [...filledCriteria];
                              newCriteria[index] = e.target.value;
                              setFilledCriteria(newCriteria);
                            }}
                            className="font-mono text-sm"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleCopy(filledCriteria[index] || criterion, `criteria-${index}`)
                          }
                        >
                          {copied === `criteria-${index}` ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Use Given/When/Then format for testable criteria
                    </p>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {/* Apply Button */}
            {onTemplateApply && (
              <Button className="w-full" onClick={handleApplyTemplate}>
                Apply Template
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AITemplateGenerator;
