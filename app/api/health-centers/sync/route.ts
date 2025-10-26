import { NextResponse } from 'next/server';
// TODO: Supabase 서버 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/server';

// 보건소 명칭 동기화 API
// health_center_id를 통해 매핑된 데이터를 조회
export async function POST(request: Request) {
  try {
    const { healthCenterName, userId } = await request.json();
    const supabase = await createClient();

    // 1. 보건소 ID 찾기 (fuzzy matching 함수 호출)
    const { data: centerData, error: centerError } = await supabase
      .rpc('find_health_center_id', { input_name: healthCenterName });

    if (centerError) {
      console.error('Error finding health center:', centerError);
      return NextResponse.json(
        { error: 'Failed to find health center', fallback: true },
        { status: 404 }
      );
    }

    if (!centerData) {
      // 보건소를 찾을 수 없는 경우 - 텍스트 기반 매칭으로 fallback
      return NextResponse.json({
        success: false,
        message: 'Health center not found',
        fallback: true,
        originalName: healthCenterName
      });
    }

    // 2. 사용자 프로필 업데이트 (health_center_id 저장)
    if (userId) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          health_center_id: centerData,
          organization_text: healthCenterName // fallback용 원본 텍스트 저장
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating profile:', updateError);
      }
    }

    // 3. 보건소 정보 반환
    const { data: healthCenter, error: fetchError } = await supabase
      .from('health_centers')
      .select('*')
      .eq('id', centerData)
      .single();

    if (fetchError) {
      console.error('Error fetching health center details:', fetchError);
      return NextResponse.json({
        success: true,
        healthCenterId: centerData,
        originalName: healthCenterName
      });
    }

    return NextResponse.json({
      success: true,
      healthCenter: {
        id: healthCenter.id,
        code: healthCenter.code,
        canonicalName: healthCenter.canonical_name,
        sido: healthCenter.sido,
        gugun: healthCenter.gugun
      },
      originalName: healthCenterName
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 보건소 명칭 매핑 테이블 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const healthCenterId = searchParams.get('id');
    const name = searchParams.get('name');
    
    const supabase = await createClient();

    if (healthCenterId) {
      // ID로 직접 조회
      const { data, error } = await supabase
        .from('health_centers')
        .select(`
          *,
          health_center_aliases (
            alias_name,
            alias_type
          )
        `)
        .eq('id', healthCenterId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ healthCenter: data });
      
    } else if (name) {
      // 이름으로 검색 (fuzzy matching)
      const { data: centerId, error: rpcError } = await supabase
        .rpc('find_health_center_id', { input_name: name });

      if (rpcError || !centerId) {
        return NextResponse.json(
          { error: 'Health center not found', name },
          { status: 404 }
        );
      }

      // 찾은 ID로 상세 정보 조회
      const { data, error } = await supabase
        .from('health_centers')
        .select(`
          *,
          health_center_aliases (
            alias_name,
            alias_type
          )
        `)
        .eq('id', centerId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ 
        healthCenter: data,
        searchedName: name,
        matched: true 
      });
    }

    // 모든 보건소 목록 반환
    const { data, error } = await supabase
      .from('health_centers')
      .select('id, code, canonical_name, sido, gugun')
      .order('canonical_name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ healthCenters: data });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}