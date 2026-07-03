import { usePredictIssueCompletionQuery } from '../aiApi';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface IssueCompletionPredictorProps {
  issueId: string;
  projectId: string;
}

export function IssueCompletionPredictor({
  issueId,
  projectId,
}: IssueCompletionPredictorProps) {
  const { data: prediction, isLoading, error } = usePredictIssueCompletionQuery({
    issueId,
    projectId,
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Unable to predict completion time
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Completion Prediction
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : prediction ? (
          <div className="space-y-4">
            {/* Main Prediction */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {prediction.predictedDays}
                  </span>
                  <span className="text-muted-foreground">days</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Est. {new Date(prediction.predictedDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <Badge
                  variant="outline"
                  className={getConfidenceColor(prediction.confidence)}
                >
                  {getConfidenceLabel(prediction.confidence)} Confidence
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round(prediction.confidence * 100)}%
                </div>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Confidence</span>
                <span>{Math.round(prediction.confidence * 100)}%</span>
              </div>
              <Progress
                value={prediction.confidence * 100}
                className="h-2"
              />
            </div>

            {/* Range */}
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Best Case</span>
                  </div>
                  <div className="font-semibold">
                    {prediction.range.optimistic} days
                  </div>
                </div>
                <div className="flex-1 mx-4 h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded" />
                <div className="text-center">
                  <div className="flex items-center gap-1 text-orange-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>Worst Case</span>
                  </div>
                  <div className="font-semibold">
                    {prediction.range.pessimistic} days
                  </div>
                </div>
              </div>
            </div>

            {/* Factors */}
            {prediction.factors.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <TrendingUp className="h-4 w-4" />
                  Key Factors
                </div>
                <div className="flex flex-wrap gap-2">
                  {prediction.factors.map((factor, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {factor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Reasoning */}
            {prediction.reasoning && (
              <p className="text-xs text-muted-foreground border-t pt-3">
                {prediction.reasoning}
              </p>
            )}

            {/* Processing Time */}
            <p className="text-xs text-muted-foreground text-right">
              Generated in {prediction.processingTimeMs}ms
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No prediction available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
