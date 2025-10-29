import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';

import { prisma } from '@/lib/prisma';
export async function GET() {
  try {
    // 사용자 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // category_1, category_2, category_3의 distinct 값들을 조회
    // 충분한 샘플을 가져와서 모든 고유값을 수집
    const data = await prisma.aed_data.findMany({
      select: {
        category_1: true,
        category_2: true,
        category_3: true
      },
      take: 10000
    });

    // 계층적 매핑 생성
    const hierarchicalMap = new Map<string, Map<string, Set<string>>>();

    data?.forEach(row => {
      if (!row.category_1) return;

      if (!hierarchicalMap.has(row.category_1)) {
        hierarchicalMap.set(row.category_1, new Map());
      }

      const cat1Map = hierarchicalMap.get(row.category_1)!;

      if (row.category_2) {
        if (!cat1Map.has(row.category_2)) {
          cat1Map.set(row.category_2, new Set());
        }

        if (row.category_3) {
          cat1Map.get(row.category_2)!.add(row.category_3);
        }
      }
    });

    // 계층적 구조로 변환
    const hierarchical: Record<string, Record<string, string[]>> = {};
    hierarchicalMap.forEach((cat2Map, cat1) => {
      hierarchical[cat1] = {};
      cat2Map.forEach((cat3Set, cat2) => {
        hierarchical[cat1][cat2] = Array.from(cat3Set).sort();
      });
    });

    // 유니크 값들도 함께 제공 (하위 호환성)
    const categories = {
      category_1: Array.from(hierarchicalMap.keys()).sort(),
      category_2: [...new Set(data?.map(d => d.category_2).filter(Boolean))].sort(),
      category_3: [...new Set(data?.map(d => d.category_3).filter(Boolean))].sort(),
      hierarchical, // 계층적 데이터 추가
    };

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
