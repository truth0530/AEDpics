import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { normalizeRegionName } from '@/lib/constants/regions';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') || '2025';
    const sidoParam = searchParams.get('sido');
    // target_list_2025/2024는 약칭("대구", "서울")으로 저장되어 있으므로
    // normalizeRegionName으로 정식명칭 → 약칭 변환
    const sido = sidoParam ? normalizeRegionName(sidoParam) : undefined;
    const gugunParam = searchParams.get('gugun');
    const gugun = gugunParam ? normalizeRegionName(gugunParam) : undefined;

    // year 값 검증 (SQL injection 방지)
    if (year !== '2024' && year !== '2025') {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    const yearSuffix = year === '2025' ? '_2025' : '_2024';

    // 전체 의무설치기관 수
    const targetWhere: any = {
      data_year: parseInt(year)
    };
    if (sido) targetWhere.sido = sido;
    if (gugun) targetWhere.gugun = gugun;

    const totalTargets = year === '2025'
      ? await prisma.target_list_2025.count({ where: targetWhere })
      : await prisma.target_list_2024.count({ where: targetWhere });

    // 확인된 설치 기관 수
    const confirmedMappings = await prisma.management_number_group_mapping.findMany({
      where: {
        [`confirmed${yearSuffix}`]: true,
        [`target_key${yearSuffix}`]: { not: null }
      },
      select: {
        [`target_key${yearSuffix}`]: true
      }
    });

    const uniqueConfirmedTargets = new Set(
      confirmedMappings.map(m => m[`target_key${yearSuffix}`])
    );
    const installedCount = uniqueConfirmedTargets.size;

    // 미설치 확인 수 (명시적으로 미설치로 표시된 것)
    const notInstalledTargets = year === '2025'
      ? await prisma.target_list_2025.findMany({
          where: {
            ...targetWhere,
            target_key: {
              notIn: Array.from(uniqueConfirmedTargets).filter(Boolean) as string[]
            }
          },
          select: { target_key: true }
        })
      : await prisma.target_list_2024.findMany({
          where: {
            ...targetWhere,
            target_key: {
              notIn: Array.from(uniqueConfirmedTargets).filter(Boolean) as string[]
            }
          },
          select: { target_key: true }
        });

    // 지역별 통계
    const regionStats = [];

    if (!sido && !gugun) {
      // 전국 시도별 통계
      const sidoList = year === '2025'
        ? await prisma.target_list_2025.findMany({
            where: { data_year: parseInt(year) },
            select: { sido: true },
            distinct: ['sido']
          })
        : await prisma.target_list_2024.findMany({
            where: { data_year: parseInt(year) },
            select: { sido: true },
            distinct: ['sido']
          });

      for (const { sido: sidoName } of sidoList) {
        if (!sidoName) continue;

        const sidoTotal = year === '2025'
          ? await prisma.target_list_2025.count({
              where: {
                data_year: parseInt(year),
                sido: sidoName
              }
            })
          : await prisma.target_list_2024.count({
              where: {
                data_year: parseInt(year),
                sido: sidoName
              }
            });

        const sidoTargets = year === '2025'
          ? await prisma.target_list_2025.findMany({
              where: {
                data_year: parseInt(year),
                sido: sidoName
              },
              select: { target_key: true }
            })
          : await prisma.target_list_2024.findMany({
              where: {
                data_year: parseInt(year),
                sido: sidoName
              },
              select: { target_key: true }
            });

        const sidoTargetKeys = sidoTargets.map(t => t.target_key);

        const sidoConfirmed = await prisma.management_number_group_mapping.count({
          where: {
            [`confirmed${yearSuffix}`]: true,
            [`target_key${yearSuffix}`]: {
              in: sidoTargetKeys
            }
          }
        });

        regionStats.push({
          region: sidoName,
          total: sidoTotal,
          installed: sidoConfirmed,
          notInstalled: sidoTotal - sidoConfirmed,
          installationRate: sidoTotal > 0 ? (sidoConfirmed / sidoTotal * 100) : 0
        });
      }
    } else if (sido && !gugun) {
      // 특정 시도의 시군구별 통계
      const gugunList = year === '2025'
        ? await prisma.target_list_2025.findMany({
            where: {
              data_year: parseInt(year),
              sido: sido
            },
            select: { gugun: true },
            distinct: ['gugun']
          })
        : await prisma.target_list_2024.findMany({
            where: {
              data_year: parseInt(year),
              sido: sido
            },
            select: { gugun: true },
            distinct: ['gugun']
          });

      for (const { gugun: gugunName } of gugunList) {
        if (!gugunName) continue;

        const gugunTotal = year === '2025'
          ? await prisma.target_list_2025.count({
              where: {
                data_year: parseInt(year),
                sido: sido,
                gugun: gugunName
              }
            })
          : await prisma.target_list_2024.count({
              where: {
                data_year: parseInt(year),
                sido: sido,
                gugun: gugunName
              }
            });

        const gugunTargets = year === '2025'
          ? await prisma.target_list_2025.findMany({
              where: {
                data_year: parseInt(year),
                sido: sido,
                gugun: gugunName
              },
              select: { target_key: true }
            })
          : await prisma.target_list_2024.findMany({
              where: {
                data_year: parseInt(year),
                sido: sido,
                gugun: gugunName
              },
              select: { target_key: true }
            });

        const gugunTargetKeys = gugunTargets.map(t => t.target_key);

        const gugunConfirmed = await prisma.management_number_group_mapping.count({
          where: {
            [`confirmed${yearSuffix}`]: true,
            [`target_key${yearSuffix}`]: {
              in: gugunTargetKeys
            }
          }
        });

        regionStats.push({
          region: `${sido} ${gugunName}`,
          total: gugunTotal,
          installed: gugunConfirmed,
          notInstalled: gugunTotal - gugunConfirmed,
          installationRate: gugunTotal > 0 ? (gugunConfirmed / gugunTotal * 100) : 0
        });
      }
    }

    // 기관 분류별 통계
    let divisionStats: any[] = [];
    const targetTable = year === '2025' ? 'target_list_2025' : 'target_list_2024';
    const targetTableRaw = Prisma.raw(`aedpics.${targetTable}`);
    const targetKeyCol = year === '2025' ? 'target_key_2025' : 'target_key_2024';
    const confirmedCol = year === '2025' ? 'confirmed_2025' : 'confirmed_2024';

    if (sido && gugun) {
      divisionStats = await prisma.$queryRaw`
        SELECT
          sub_division,
          COUNT(*)::int as total,
          COUNT(CASE WHEN m.${Prisma.raw(confirmedCol)} = true THEN 1 END)::int as installed
        FROM ${targetTableRaw} t
        LEFT JOIN aedpics.management_number_group_mapping m
          ON t.target_key = m.${Prisma.raw(targetKeyCol)}
        WHERE t.data_year = ${parseInt(year)}
          AND t.sido = ${sido}
          AND t.gugun = ${gugun}
        GROUP BY sub_division
        ORDER BY total DESC
      `;
    } else if (sido) {
      divisionStats = await prisma.$queryRaw`
        SELECT
          sub_division,
          COUNT(*)::int as total,
          COUNT(CASE WHEN m.${Prisma.raw(confirmedCol)} = true THEN 1 END)::int as installed
        FROM ${targetTableRaw} t
        LEFT JOIN aedpics.management_number_group_mapping m
          ON t.target_key = m.${Prisma.raw(targetKeyCol)}
        WHERE t.data_year = ${parseInt(year)}
          AND t.sido = ${sido}
        GROUP BY sub_division
        ORDER BY total DESC
      `;
    } else {
      divisionStats = await prisma.$queryRaw`
        SELECT
          sub_division,
          COUNT(*)::int as total,
          COUNT(CASE WHEN m.${Prisma.raw(confirmedCol)} = true THEN 1 END)::int as installed
        FROM ${targetTableRaw} t
        LEFT JOIN aedpics.management_number_group_mapping m
          ON t.target_key = m.${Prisma.raw(targetKeyCol)}
        WHERE t.data_year = ${parseInt(year)}
        GROUP BY sub_division
        ORDER BY total DESC
      `;
    }

    // 최근 확인 이력
    const recentConfirms = await prisma.management_number_group_mapping.findMany({
      where: {
        [`confirmed_at${yearSuffix}`]: { not: null }
      },
      orderBy: {
        [`confirmed_at${yearSuffix}`]: 'desc'
      },
      take: 10,
      select: {
        management_number: true,
        [`target_key${yearSuffix}`]: true,
        [`confirmed_at${yearSuffix}`]: true,
        [`confirmed_by${yearSuffix}`]: true,
        [`modification_note${yearSuffix}`]: true
      }
    });

    // 사용자별 처리 통계 (오늘)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userStats = await prisma.management_number_group_mapping.groupBy({
      by: [`confirmed_by${yearSuffix}`],
      where: {
        [`confirmed_at${yearSuffix}`]: {
          gte: today
        }
      },
      _count: true
    });

    return NextResponse.json({
      summary: {
        year: parseInt(year),
        region: sido ? (gugun ? `${sido} ${gugun}` : sido) : '전국',
        totalTargets,
        installedCount,
        notInstalledCount: totalTargets - installedCount,
        pendingCount: totalTargets - installedCount,
        installationRate: totalTargets > 0 ? (installedCount / totalTargets * 100) : 0
      },
      regionStats: regionStats.sort((a, b) => b.installationRate - a.installationRate),
      divisionStats,
      recentConfirms,
      todayUserStats: userStats
    });

  } catch (error) {
    console.error('Statistics error:', error);
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}