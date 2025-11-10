import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDuplicateAssignments() {
  try {
    // 모든 장비의 할당 히스토리 조회
    const allAssignments = await prisma.inspection_assignments.findMany({
      orderBy: [
        { equipment_serial: 'asc' },
        { created_at: 'desc' }
      ],
      select: {
        id: true,
        equipment_serial: true,
        assigned_to: true,
        status: true,
        created_at: true,
        user_profiles_inspection_assignments_assigned_toTouser_profiles: {
          select: { full_name: true }
        }
      }
    });

    // 장비별로 그룹화
    const grouped = {};
    allAssignments.forEach(a => {
      if (!grouped[a.equipment_serial]) {
        grouped[a.equipment_serial] = [];
      }
      grouped[a.equipment_serial].push(a);
    });

    // 삭제 대상 찾기
    const toDelete = [];
    const summary = {
      totalEquipment: 0,
      equipmentWithMultiple: 0,
      totalToDelete: 0,
      keepActive: 0,
      details: []
    };

    Object.entries(grouped).forEach(([serial, assignments]) => {
      if (assignments.length > 1) {
        summary.equipmentWithMultiple++;

        // 현재 진행중인 할당 찾기
        const activeAssignment = assignments.find(a => a.status === 'in_progress');
        const keepAssignment = activeAssignment || assignments[0];

        assignments.forEach(a => {
          if (a.id !== keepAssignment.id) {
            toDelete.push(a);
          }
        });

        if (activeAssignment) {
          summary.keepActive++;
        }

        summary.details.push({
          equipment_serial: serial,
          total_assignments: assignments.length,
          to_delete: assignments.length - 1,
          keep: {
            id: keepAssignment.id,
            status: keepAssignment.status,
            created_at: keepAssignment.created_at,
            assigned_to_name: keepAssignment.user_profiles_inspection_assignments_assigned_toTouser_profiles?.full_name
          },
          will_delete: assignments
            .filter(a => a.id !== keepAssignment.id)
            .map(a => ({
              id: a.id,
              status: a.status,
              created_at: a.created_at,
              assigned_to_name: a.user_profiles_inspection_assignments_assigned_toTouser_profiles?.full_name
            }))
        });
      }
    });

    summary.totalEquipment = Object.keys(grouped).length;
    summary.totalToDelete = toDelete.length;

    console.log('\n=== 삭제 대상 분석 ===\n');
    console.log(`총 장비 수: ${summary.totalEquipment}`);
    console.log(`중복 할당 장비: ${summary.equipmentWithMultiple}개`);
    console.log(`삭제 대상: ${summary.totalToDelete}개`);
    console.log(`유지될 활성 할당(in_progress): ${summary.keepActive}개\n`);

    if (summary.details.length > 0) {
      console.log('=== 상세 내역 ===\n');
      summary.details.forEach(detail => {
        console.log(`🔧 ${detail.equipment_serial} (총 ${detail.total_assignments}개 할당)`);
        console.log(`   ✓ 유지: ${detail.keep.status} (${detail.keep.assigned_to_name}, ${detail.keep.created_at.toISOString().split('T')[0]})`);
        detail.will_delete.forEach(d => {
          console.log(`   ✗ 삭제: ${d.status} (${d.assigned_to_name}, ${d.created_at.toISOString().split('T')[0]})`);
        });
        console.log();
      });
    }

    console.log('=== 삭제할 ID 목록 ===\n');
    const deleteIds = toDelete.map(a => a.id);
    console.log(`const toDeleteIds = [`);
    deleteIds.forEach((id, i) => {
      console.log(`  '${id}'${i < deleteIds.length - 1 ? ',' : ''}`);
    });
    console.log(`];\n`);

    console.log(`총 ${summary.totalToDelete}개의 구 할당 레코드를 삭제할 수 있습니다.`);
    console.log('✓ 미리보기 완료. 안전하게 확인할 수 있습니다.\n');

    return {
      toDelete,
      summary
    };

  } catch (error) {
    console.error('오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const result = await findDuplicateAssignments();
process.exit(result ? 0 : 1);
