'use client';

import { useRouter } from 'next/navigation';

interface Feature {
  icon: string;
  title: string;
  description: string;
  link?: string;
}

interface HomeClientProps {
  features: Feature[];
}

export default function HomeClient({ features }: HomeClientProps) {
  const router = useRouter();

  const handleFeatureClick = (feature: Feature) => {
    if (feature.link) {
      router.push(feature.link);
    } else if (feature.icon === 'hospital') {
      router.push('/inspection'); // 보건소 현지 점검 - 실제 점검 시스템으로 이동
    } else if (feature.icon === 'report') {
      router.push('/presentation');
    } else if (feature.icon === 'sync') {
      router.push('/presentation/page2');
    } else if (feature.icon === 'chart') {
      router.push('/presentation/presentation3');
    } else if (feature.icon === 'map') {
      router.push('/map'); // 위치 기반 점검 - 지도 페이지로 이동
    }
  };

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {features.map((feature, index) => (
        <div
          key={index}
          className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700 transition-all hover:transform hover:scale-105 duration-200 cursor-pointer"
          onClick={() => handleFeatureClick(feature)}
        >
          <div className="mb-4">
            {feature.icon === 'hospital' && (
              <svg className="w-12 h-12 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L4 7v10c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5zm6 15h-4v4h-4v-4H6v-4h4V9h4v4h4v4z"/>
              </svg>
            )}
            {feature.icon === 'mobile' && (
              <svg className="w-12 h-12 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
              </svg>
            )}
            {feature.icon === 'map' && (
              <svg className="w-12 h-12 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            )}
            {feature.icon === 'chart' && (
              <svg className="w-12 h-12 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            )}
            {feature.icon === 'sync' && (
              <svg className="w-12 h-12 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
            )}
            {feature.icon === 'report' && (
              <svg className="w-12 h-12 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            )}
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            {feature.title}
          </h3>
          <p className="text-gray-400">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  );
}
