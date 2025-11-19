'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, Info, Sparkles, Target, MapPin } from 'lucide-react';

interface Suggestion {
  equipment_serial: string;
  management_number: string;
  institution_name: string;
  address: string;
  confidence_score: number;
  match_type: string;
  is_primary?: boolean;
}

interface AutoSuggestResult {
  targetKey: string;
  targetName: string;
  targetAddress?: string;
  matchType: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  suggestions: Suggestion[];
  metadata?: {
    nameConfidence: number;
    addressConfidence: number;
    matchingRules: string[];
    dataChanged: boolean;
    lastUpdated: string;
  };
}

interface AutoSuggestCardProps {
  targetKey: string;
  targetName?: string;
  onConfirm?: (targetKey: string, equipmentSerial: string) => void;
  onReject?: () => void;
  className?: string;
}

export default function AutoSuggestCard({
  targetKey,
  targetName,
  onConfirm,
  onReject,
  className = ''
}: AutoSuggestCardProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutoSuggestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // 자동추천 데이터 가져오기
  useEffect(() => {
    if (targetKey) {
      fetchSuggestions();
    }
  }, [targetKey]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/compliance/auto-suggest?target_key=${targetKey}`);

      if (!response.ok) {
        throw new Error('자동추천 데이터를 가져올 수 없습니다');
      }

      const data = await response.json();
      setResult(data);

      // 첫 번째 추천을 기본 선택
      if (data.suggestions?.length > 0) {
        setSelectedSerial(data.suggestions[0].equipment_serial);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSerial || !onConfirm) return;

    setConfirming(true);
    try {
      await fetch('/api/compliance/auto-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKey,
          equipmentSerial: selectedSerial,
          confirmed: true
        })
      });

      onConfirm(targetKey, selectedSerial);
    } catch (err) {
      setError('확정 처리 중 오류가 발생했습니다');
    } finally {
      setConfirming(false);
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getConfidenceText = (level: string) => {
    switch (level) {
      case 'high':
        return '높은 신뢰도';
      case 'medium':
        return '중간 신뢰도';
      case 'low':
        return '낮은 신뢰도';
      default:
        return '알 수 없음';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>자동추천 분석 중...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <CardTitle>TNMS 자동추천</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={`${getConfidenceColor(result.confidenceLevel)} text-white`}
          >
            {getConfidenceText(result.confidenceLevel)}
          </Badge>
        </div>
        <CardDescription>
          {targetName || result.targetName}
          {result.targetAddress && (
            <span className="block text-xs mt-1">
              <MapPin className="inline h-3 w-3" /> {result.targetAddress}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 추천 목록 */}
        <div className="space-y-2">
          {result.suggestions.map((suggestion, idx) => (
            <div
              key={suggestion.equipment_serial}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                selectedSerial === suggestion.equipment_serial
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedSerial(suggestion.equipment_serial)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{suggestion.institution_name}</span>
                    {suggestion.is_primary && (
                      <Badge variant="secondary" className="text-xs">추천</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>관리번호: {suggestion.management_number}</div>
                    <div>장비연번: {suggestion.equipment_serial}</div>
                    <div className="text-xs mt-1">
                      <MapPin className="inline h-3 w-3" /> {suggestion.address}
                    </div>
                  </div>
                </div>
                {suggestion.confidence_score > 0 && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-700">
                      {suggestion.confidence_score}%
                    </div>
                    <div className="text-xs text-gray-500">일치율</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 메타데이터 표시 */}
        {result.metadata && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-1">
              <div>이름 일치율: {result.metadata.nameConfidence}%</div>
              <div>주소 일치율: {result.metadata.addressConfidence}%</div>
              {result.metadata.dataChanged && (
                <div className="text-orange-600">최근 데이터 변경 감지됨</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleConfirm}
            disabled={!selectedSerial || confirming}
            className="flex-1"
          >
            {confirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                확정 중...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                매칭 확정
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onReject}
            disabled={confirming}
          >
            수동 선택
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}