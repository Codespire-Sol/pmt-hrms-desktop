import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sparkles,
  Wand2,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Lightbulb,
} from 'lucide-react';
import {
  useEnhanceContentMutation,
  useGenerateContentVariantsMutation,
  useImproveWithFeedbackMutation,
  useGetAvailableTonesQuery,
  useGetAvailableStylesQuery,
} from '../aiApi';
import type { ContentTone, ContentStyleEnhanced, ContentVariant } from '../types';

interface EnhancedContentEditorProps {
  initialContent?: string;
  onContentSelect?: (content: string) => void;
  context?: string;
  showVariants?: boolean;
  showFeedback?: boolean;
}

const TONE_LABELS: Record<ContentTone, { label: string; icon: string }> = {
  professional: { label: 'Professional', icon: 'briefcase' },
  friendly: { label: 'Friendly', icon: 'smile' },
  technical: { label: 'Technical', icon: 'code' },
  concise: { label: 'Concise', icon: 'minimize' },
  detailed: { label: 'Detailed', icon: 'maximize' },
  assertive: { label: 'Assertive', icon: 'bold' },
  empathetic: { label: 'Empathetic', icon: 'heart' },
  formal: { label: 'Formal', icon: 'file-text' },
  casual: { label: 'Casual', icon: 'coffee' },
};

const STYLE_LABELS: Record<ContentStyleEnhanced, { label: string; description: string }> = {
  clearer: { label: 'Clearer', description: 'Remove ambiguities' },
  concise: { label: 'Concise', description: 'Remove unnecessary words' },
  detailed: { label: 'Detailed', description: 'Add more specifics' },
  professional: { label: 'Professional', description: 'Business-appropriate' },
  technical: { label: 'Technical', description: 'Add technical precision' },
  actionable: { label: 'Actionable', description: 'Clear next steps' },
  persuasive: { label: 'Persuasive', description: 'Compelling and engaging' },
};

export function EnhancedContentEditor({
  initialContent = '',
  onContentSelect,
  context,
  showVariants = true,
  showFeedback = true,
}: EnhancedContentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [selectedTone, setSelectedTone] = useState<ContentTone>('professional');
  const [selectedStyle, setSelectedStyle] = useState<ContentStyleEnhanced>('clearer');
  const [enhancedContent, setEnhancedContent] = useState<string>('');
  const [variants, setVariants] = useState<ContentVariant[]>([]);
  const [feedback, setFeedback] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showImprovements, setShowImprovements] = useState(false);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [previousVersions, setPreviousVersions] = useState<string[]>([]);

  const { data: tonesData } = useGetAvailableTonesQuery();
  const { data: stylesData } = useGetAvailableStylesQuery();

  const [enhanceContent, { isLoading: isEnhancing }] = useEnhanceContentMutation();
  const [generateVariants, { isLoading: isGeneratingVariants }] =
    useGenerateContentVariantsMutation();
  const [improveWithFeedback, { isLoading: isImprovingWithFeedback }] =
    useImproveWithFeedbackMutation();

  const handleEnhance = useCallback(async () => {
    if (!content.trim()) return;

    try {
      const result = await enhanceContent({
        text: content,
        tone: selectedTone,
        style: selectedStyle,
        context,
        preserveStructure: false,
      }).unwrap();

      setEnhancedContent(result.enhancedText);
      setImprovements(result.improvements);
      setSuggestions(result.suggestions);
      setPreviousVersions((prev) => [...prev.slice(-2), content]);
    } catch (error) {
      console.error('Failed to enhance content:', error);
    }
  }, [content, selectedTone, selectedStyle, context, enhanceContent]);

  const handleGenerateVariants = useCallback(async () => {
    if (!content.trim()) return;

    const tones: ContentTone[] = ['professional', 'friendly', 'concise', 'technical'];

    try {
      const result = await generateVariants({
        text: content,
        tones,
        context,
      }).unwrap();

      setVariants(result.variants);
    } catch (error) {
      console.error('Failed to generate variants:', error);
    }
  }, [content, context, generateVariants]);

  const handleImproveWithFeedback = useCallback(async () => {
    if (!enhancedContent.trim() || !feedback.trim()) return;

    try {
      const result = await improveWithFeedback({
        text: enhancedContent,
        feedback,
        previousVersions,
      }).unwrap();

      setEnhancedContent(result.improvedText);
      setImprovements(result.changesMade);
      setSuggestions(result.additionalSuggestions);
      setPreviousVersions((prev) => [...prev.slice(-2), enhancedContent]);
      setFeedback('');
    } catch (error) {
      console.error('Failed to improve with feedback:', error);
    }
  }, [enhancedContent, feedback, previousVersions, improveWithFeedback]);

  const handleCopy = useCallback(async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const handleUseContent = useCallback(
    (text: string) => {
      if (onContentSelect) {
        onContentSelect(text);
      }
    },
    [onContentSelect]
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Content Enhancement
        </CardTitle>
        <CardDescription>
          Enhance your content with AI-powered tone and style adjustments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-2">
          <Label htmlFor="content">Your Content</Label>
          <Textarea
            id="content"
            placeholder="Enter the content you want to enhance..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <div className="text-xs text-muted-foreground text-right">
            {content.split(/\s+/).filter(Boolean).length} words
          </div>
        </div>

        {/* Tone and Style Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={selectedTone} onValueChange={(v) => setSelectedTone(v as ContentTone)}>
              <SelectTrigger>
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                {(tonesData?.tones || Object.entries(TONE_LABELS).map(([value, { label }]) => ({
                  value,
                  description: label,
                }))).map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>
                    <div className="flex flex-col">
                      <span>{TONE_LABELS[tone.value as ContentTone]?.label || tone.value}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {tone.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Style</Label>
            <Select
              value={selectedStyle}
              onValueChange={(v) => setSelectedStyle(v as ContentStyleEnhanced)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                {(stylesData?.styles || Object.entries(STYLE_LABELS).map(([value, { label, description }]) => ({
                  value,
                  description,
                }))).map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    <div className="flex flex-col">
                      <span>{STYLE_LABELS[style.value as ContentStyleEnhanced]?.label || style.value}</span>
                      <span className="text-xs text-muted-foreground">
                        {style.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleEnhance}
            disabled={!content.trim() || isEnhancing}
            className="flex-1"
          >
            {isEnhancing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-2" />
            )}
            Enhance Content
          </Button>
          {showVariants && (
            <Button
              variant="outline"
              onClick={handleGenerateVariants}
              disabled={!content.trim() || isGeneratingVariants}
            >
              {isGeneratingVariants ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Variants
            </Button>
          )}
        </div>

        {/* Results Section */}
        {(enhancedContent || variants.length > 0) && (
          <Tabs defaultValue="enhanced" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="enhanced" disabled={!enhancedContent}>
                Enhanced Result
              </TabsTrigger>
              <TabsTrigger value="variants" disabled={variants.length === 0}>
                Variants ({variants.length})
              </TabsTrigger>
            </TabsList>

            {/* Enhanced Content Tab */}
            <TabsContent value="enhanced" className="space-y-4">
              {enhancedContent && (
                <>
                  <div className="relative">
                    <div className="absolute top-2 right-2 flex gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(enhancedContent, -1)}
                            >
                              {copiedIndex === -1 ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy to clipboard</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <ScrollArea className="h-[200px] border rounded-md p-3 bg-muted/30">
                      <pre className="whitespace-pre-wrap text-sm">{enhancedContent}</pre>
                    </ScrollArea>
                  </div>

                  {/* Improvements Toggle */}
                  {improvements.length > 0 && (
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => setShowImprovements(!showImprovements)}
                      >
                        <span className="flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" />
                          {improvements.length} improvements made
                        </span>
                        {showImprovements ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      {showImprovements && (
                        <ul className="space-y-1 pl-4">
                          {improvements.map((improvement, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground">
                              - {improvement}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Suggestions */}
                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Further Suggestions
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((suggestion, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {suggestion}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feedback Section */}
                  {showFeedback && (
                    <div className="space-y-2">
                      <Separator />
                      <Label className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Provide Feedback
                      </Label>
                      <Textarea
                        placeholder="Tell the AI what you'd like to change..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleImproveWithFeedback}
                        disabled={!feedback.trim() || isImprovingWithFeedback}
                      >
                        {isImprovingWithFeedback ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Improve with Feedback
                      </Button>
                    </div>
                  )}

                  {/* Use Button */}
                  {onContentSelect && (
                    <Button className="w-full" onClick={() => handleUseContent(enhancedContent)}>
                      Use This Content
                    </Button>
                  )}
                </>
              )}
            </TabsContent>

            {/* Variants Tab */}
            <TabsContent value="variants" className="space-y-4">
              {variants.map((variant, index) => (
                <div
                  key={index}
                  className="border rounded-md p-3 space-y-2 hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">
                      {TONE_LABELS[variant.tone as ContentTone]?.label || variant.tone}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {variant.wordCount} words
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(variant.text, index)}
                            >
                              {copiedIndex === index ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy to clipboard</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <p className="text-sm">{variant.text}</p>
                  {variant.keyChanges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {variant.keyChanges.map((change, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {change}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {onContentSelect && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleUseContent(variant.text)}
                    >
                      Use This Variant
                    </Button>
                  )}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

export default EnhancedContentEditor;
