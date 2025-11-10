import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteDuplicateAssignments() {
  try {
    // 삭제할 ID 목록
    const toDeleteIds = [
      'bb5f18f8-5678-4c24-88b8-74fca2305775',
      '067208ee-8c61-460a-b6f3-b1a2a82b5bce',
      '6d371806-136e-4786-8803-71e840c72be4',
      '2440a43c-27d9-46ad-9623-8155fd03f70c',
      'a91b03e2-06ab-4279-acb1-b136f7ef8a67',
      '356b110e-1543-44ac-b35e-a8370c5c6644',
      '8121c151-bd68-4cca-a9c1-03c7bd7c9098',
      'f6f16626-9774-43f4-b31c-8119f0b56b80',
      '2444395c-1f13-42cc-b1e0-98407e5cf5f0',
      '32ce70cc-6ee0-4d56-8dfe-9955098fa2ab',
      'df317775-31bf-4dbc-bb76-5ea556bfc68e',
      'a5cdc915-0ade-4f3e-a51d-f06052c29244',
      'af3f70e7-33e6-4799-87b9-c955e1c7d623',
      'eb5ec428-0b30-482f-a6df-923c71b55ba3',
      '18853015-33d2-4ea4-a24f-19816f141270',
      'dbc34178-b887-4b2c-931e-60b2b843a954',
      'b3e313f0-df51-446e-a3f0-347bc7713fb1',
      'daf24750-dba5-414b-97fa-73402ca88d6a',
      '69a85019-9b05-459d-9a73-9bebd6f1ff0b',
      '07c018c0-81a0-4e33-b2ae-34c4a1b47c7f',
      '728551db-ab44-4f55-b63d-cda391a98581',
      '19eb4ee6-c49a-4c13-b837-2f17c98c50b2',
      '0c66c850-f641-45c1-a67b-1442670b5e8f',
      '61b4c47e-c91a-4e51-bc14-3382f61a592b',
      '59798e7c-d614-416f-ae70-6961172fb248',
      '914e8a80-dc74-458f-9f74-67650a8e20f9',
      'b26550f4-794d-4fea-b611-c76f304b1163',
      '19a6a154-836b-4627-bd5d-9c2ec7a007ad',
      '130faa21-1f0f-49b6-9a1b-29478d20e079',
      '268bc2c0-968b-44cd-87fa-76cb78aa3b6b',
      '554ee78b-d19a-47b8-964b-784275c41c8b',
      '8deb1182-108d-40bb-b133-ffd2acbb094d',
      'dab92e45-78a3-4037-8940-90449f79f61b',
      'e59b9636-cf64-4497-9eca-7a2cf6dbc78c',
      'b2abc910-5698-4b64-8a5c-b26bc508a2cf',
      '91aa557c-6f73-48bb-80bd-17e26388d9d3',
      'e8fdda2f-7f65-48ed-a168-c5012e8926b1',
      '3490da80-0635-448e-b746-98cc480c8737',
      '853c61fb-f779-49c5-ad7c-f3a2c33e06ea',
      '488a28be-cedc-4f6c-af0e-5ef11fa4f2dc',
      '32fc81bd-fe70-4ba8-baad-c4cbd3eaae78',
      '5e201163-c183-4db3-9099-1af1d56d5200',
      '8b1d95f0-d43c-419e-bbd1-de21e2ab1ddc',
      '9b86aa0d-40df-4d7b-8bc2-e21fe2efd2d8',
      '0d400946-f544-4d7c-8241-e82352504f6c',
      '2fada21f-c297-4cfb-a6c9-f836b1faa98f',
      'f53683ba-6684-4338-acd8-4eff2575b273',
      '91193018-f60a-45ff-b0ea-cccaec1d6fc4',
      '53e7f06e-4de8-47d5-a6e8-8f10cf96804d',
      '76fd9530-0d91-4871-9bd5-fd15df2978f0',
      '65359abf-1d88-4d5d-8d03-3c96c7770f0f',
      '6f259f36-9989-426a-bd9e-24011f0ab83b',
      'bd28837c-4c36-48c1-9e76-7604159dc533',
      '4dfa1b34-f0b6-4c8a-925d-8b47436cefdc',
      '44eb13d8-b369-49ed-b4f8-a78721ebf45a',
      'cba948ea-999c-4bbd-8180-056c0b8a85bb',
      'd951def6-c4c2-4b17-8ab6-3d5296b3d17e',
      'aa757239-ca74-4874-810c-319ac45cf9cf',
      'e7eacf60-f500-44d3-9272-fb65ae93c4ae',
      '4b2d9bbc-e425-45f1-bb13-79046cbc801f',
      '57928115-1566-4177-8337-375e1866a52c',
      '3318769d-6262-4aba-b64c-a11f04bd61c0',
      'e27524a5-2377-4d56-a325-f5c4e00fe48d',
      'a6bce8d1-c34e-421d-b01e-4757b963080f',
      '13626844-928e-4892-87d8-fa40c6bfa2d7',
      'cb4e98e5-6a96-49c7-b93e-a76fab696292',
      '14dec276-da44-4824-939a-7391a2558584',
      'c449ce11-c16f-48e2-9be7-1e5fcbd27665',
      '6074e2d8-3672-4537-b9b1-5248d2df0180',
      '630d4bbe-8446-4195-910d-0ee40ba4db7d',
      '15155282-8340-42d3-9b32-6407924a178e',
      '449f00b4-0423-4dd6-a22b-92d20f8bd421',
      '1c521fb8-445e-488e-ae65-48a36ff5fa77',
      '0b795682-9dff-41ff-9f9c-26c157826dfb',
      'ab9eae82-3500-46f5-b86e-5fe02f57f0c3',
      '6126fbfb-cf6e-4277-8779-69b7b7968fe4',
      '63f94cb4-2018-435f-8041-4bdbd0a95e88',
      '296c8095-63e6-46e5-a1f1-824b83c70cdb',
      '267c5e69-0209-4ac6-bc52-207db36ab601',
      '6fb87259-760d-4843-b72c-5bd86926a80a',
      '016cfca2-0cc1-4f28-ad19-dad595549de1',
      '588afd30-2279-4389-9727-181bba0ec32f',
      '2c682657-36ff-4ffe-a1bc-a3c91315592c',
      'c61cd2b3-3859-45dd-84b3-78b4e44a96c1',
      'd5891e06-c0fe-4698-8c85-b3dab69f615e',
      'c05005cd-9ecb-4467-87f4-b22e007f95c5',
      'e15139ef-ea0c-435f-89f8-d25a788d1ae3',
      'baa2e413-3404-4dd0-8398-20418b837e4a',
      '90d5b07d-42d8-41a6-a847-4ebbe6c597b0',
      'f8486256-7499-4aea-8a4e-c145b4a571e3',
      '3c9db78d-673a-4f21-84bf-944f0778cb9d',
      'b1a67647-426e-46d4-a521-6dbf65fa6583',
      'a8edfd24-0650-4624-8202-ebf3c52a8a6f',
      '957923d1-fb68-402f-8831-980023ee853e',
      '455435a2-ade4-4524-9150-511b1de59030',
      'd6c7b53a-f62b-4e35-8fd2-8186aac879bc',
      '54c7c779-e0b0-411f-8432-06d4663b55cf',
      '59e99c55-175e-4b0a-93d0-4e08f70cb0a1',
      'c2944e0a-2ea0-441c-b68d-c8e90d203e0c',
      '1cf0a021-721c-4875-b335-ac436c4e7380',
      '1a4fc443-98c6-4e03-b167-3b60fd9dd673',
      'ffc3ecbf-141b-44e4-a4c1-915063831b06',
      '1c5b5663-ac72-47df-bd98-7e1926fca996',
      '5634ba8a-2f91-4205-8942-444f828a8d08',
      '8b9e87b1-3408-45da-9954-5912c68aed45',
      'a77a8135-e647-40e0-a0fa-93424a0def26',
      '0767440b-0407-4cd2-8407-026aeb0135a8',
      '7f361bbb-161e-4fbf-a428-6e4888dd3d36',
      '6b89b98a-f4f5-4632-9dd8-6515afad2d12',
      '090883b8-2bc5-4b8b-b870-ad9d961f1ad5',
      '51c55b0e-cedb-46b8-bec6-c9d5214c362d',
      'e298388e-60e4-48c0-aca0-f654eb259010',
      'f0d5e4f8-d3c4-40c9-a247-24ec2b154403',
      'f089210d-dc57-482c-b973-50590a4ab73d',
      'cba360b4-5d86-4340-a06f-7e35ab6717e9',
      '7ab0608f-f3a8-45d0-bb72-10da5c44faa6',
      '579d35c8-7a52-417e-9ea4-63876ed41320',
      'df2b1e8c-3113-4476-a898-93d1d4ab52fe',
      'f76c8164-5a05-48b7-841c-d6463f56d2de',
      '37992c4e-fb4c-420a-95cc-9aa033a2568c',
      '7769d21e-0d68-458c-8df5-a2b3c1a60859',
      '1b01cce6-ae79-4455-95eb-e9e68431337e',
      'c7a4aad6-0d42-4608-8d47-ce194b5ca872',
      '407757f1-8cae-45e2-8f35-65b8320edc8b',
      'eb1affa5-964b-4e96-a619-b48d3d9d0fa5',
      '89155b3c-13d9-4d7f-8c04-d5b926f1719b',
      '023baae0-0732-458e-ba66-67259dcb6310',
      '1f02579a-fccc-4a44-be6b-d27c31076b15',
      '039db787-096f-44c7-b745-2838edc6ca33',
      '07821bee-63f4-432d-ac75-cb120d03ad45',
      '2f56cec1-a7b8-4be1-b4a9-4d9387b0d248',
      '999621ec-b375-4cf4-a194-b3d67d63fc54',
      '6d3f47bc-019d-4451-b4bc-68803338eade',
      '5e8295c1-3ed4-4538-a445-c547538dc4d5',
      'dde9683c-111c-4384-82bb-3acaa92616b2',
      '69956594-6e54-4906-bf77-7493145fe90c',
      'ce15a64b-3f52-4c2e-9f5a-7c8e0d33ad47',
      '12767812-ce17-43d1-9cb5-e4b3c3e511f9',
      'b01e02e4-82e2-436b-a69f-91c51d815bea',
      '4d7c0190-01d0-4296-bc84-a96f7dbf484f',
      'bee83037-5581-4ead-a40e-cc2b1836d5f0',
      '307aba07-6790-4617-a693-04ce53a95351',
      '6f6fa32b-e282-44e6-9f03-529acc0c89b0',
      '8ac5814e-f24b-4d46-8752-5017774d12f6',
      '92353d2b-ffd2-402d-bc33-a220b01007d3',
      '66986b24-fbb9-4901-8258-1307fc7c4f32',
      'a1c4a1ab-e5f1-4064-a9d7-9a921636ef37',
      '64556425-d7a3-4930-a153-b3b0c0934b7d',
      '8323dbb4-2352-420a-a45c-f52d1ac0e946',
      'f4ad3892-a63b-47cb-a000-149a9a72a34a',
      '7db1f556-2227-4a54-a01b-d2393759186d',
      '1201d3cf-763c-4ad0-81fa-f083b4ce9fdd',
      'd830fad9-3004-4a7c-af20-3dfb7eb46a15',
      '8b022c15-d0f1-4e1f-846e-052691071126',
      '0f959b1c-d425-4b65-abfa-c5e695c08e84',
      '792a6ca7-8785-4ff3-83e1-6c727d0cfa68',
      '9fc594a2-f4fe-44a9-99bf-2bd306f21714',
      'ed590dcf-22ff-400f-ad03-f47a2fc202f7',
      '42da6293-099c-4f78-8429-1f7e99d721c3',
      '0821af2a-ed7d-4a18-8449-d7547e620bc6',
      '94787664-6342-4a19-9762-dff59871ea77',
      '0dd0db27-36ee-4042-8bfe-29cb1c8f3c3b',
      '2a7094b4-8935-4006-b587-4a5085e3fac6',
      '409ae6e4-1c14-4e6e-bf3b-a3c8491e7446',
      '19cde06f-fa67-480d-9ee7-8db2130fd4c9',
      '8645930d-bbbd-41c9-9ac3-fe0fa9f47ee1',
      '19fde716-7e0d-4b96-b085-c4b8d502a026',
      'dda3340d-6494-42ba-9adc-2ced387b4dfd',
      '86ba43fe-8773-4791-82fd-00ca8c10be16',
      '9b550f47-6406-4541-b5f8-0c89ee9e5135',
      'acd56eab-6d7d-4aff-b0be-0db732187e76',
      '1a75a680-e200-4468-9ba4-2dcf52968cad',
      '902b05da-746a-402b-98df-b5a9b469a786',
      'db8d3566-c33d-44ab-8b1a-e40a8dbceba0',
      '7b9b59d0-fe66-4afd-b52c-83dc15818772',
      'd8843d8b-9233-4ae4-99c5-c9c2268c798b',
      '36b80bb8-7b65-452f-b7b1-00c2e0170ee9',
      '878e4bf7-35b7-4a5a-8e21-22d56754a2ba',
      'fdcab77f-55d0-4296-bd5a-0938a6fc02ea',
      '2be8f04b-8bb9-45ed-a7ac-f0dfacb62439',
      '76be337b-24bb-42f0-a049-578f674f835b',
      '19e10931-ad62-4e42-96e8-904929204010',
      '9db362ef-6907-4e43-a667-d2ed2f10d99c',
      'a89c0b12-6830-4830-88bd-1ba917834657',
      'b2c5d672-12a3-4857-97a4-b233ae56a9ac',
      'cafe4c09-7898-4c70-8d21-f4b669a8c6fc',
      '6954926f-227b-41ae-9a68-23112698f151',
      '1edb829b-5da9-446d-8601-b22965ddaf25',
      'f408ef47-1086-4b59-a9bd-f46d9d794a1e',
      'cd0c48b0-2f5c-41cb-873b-eb71b6fc4658'
    ];

    console.log('\n=== 중복 할당 레코드 삭제 시작 ===\n');
    console.log(`삭제 대상: ${toDeleteIds.length}개\n`);

    // 배치 삭제 (안전을 위해 100개씩)
    const batchSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < toDeleteIds.length; i += batchSize) {
      const batch = toDeleteIds.slice(i, i + batchSize);

      const result = await prisma.inspection_assignments.deleteMany({
        where: {
          id: { in: batch }
        }
      });

      deletedCount += result.count;
      console.log(`배치 ${Math.floor(i / batchSize) + 1}: ${result.count}개 삭제 (누계: ${deletedCount}개)`);
    }

    console.log(`\n✓ 삭제 완료: 총 ${deletedCount}개\n`);

    // 삭제 후 상태 확인
    console.log('=== 삭제 후 상태 확인 ===\n');

    const allAssignments = await prisma.inspection_assignments.findMany({
      select: { equipment_serial: true }
    });

    const grouped = {};
    allAssignments.forEach(a => {
      if (!grouped[a.equipment_serial]) {
        grouped[a.equipment_serial] = 0;
      }
      grouped[a.equipment_serial]++;
    });

    const duplicatesRemaining = Object.entries(grouped).filter(([, count]) => count > 1);

    console.log(`총 할당 레코드: ${allAssignments.length}개`);
    console.log(`전체 장비 수: ${Object.keys(grouped).length}개`);
    console.log(`중복 할당 장비: ${duplicatesRemaining.length}개`);

    if (duplicatesRemaining.length > 0) {
      console.log('\n⚠️ 남아있는 중복:');
      duplicatesRemaining.forEach(([serial, count]) => {
        console.log(`  - ${serial}: ${count}개`);
      });
    } else {
      console.log('\n✓ 모든 중복이 제거되었습니다!\n');
    }

  } catch (error) {
    console.error('오류:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

await deleteDuplicateAssignments();
