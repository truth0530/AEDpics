"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

const SignatureCanvas = dynamic(() => import("react-signature-canvas"), {
    ssr: false,
    loading: () => <div className="w-full h-40 bg-gray-100 animate-pulse rounded-lg" />,
}) as any;
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SecurityPledgeProps {
    preview?: boolean;
    onComplete?: () => void;
    redirectTo?: string;
}

export function SecurityPledge({ preview = false, onComplete, redirectTo = "/dashboard" }: SecurityPledgeProps) {
    const { data: session } = useSession();
    const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
    const [agreedToSecurity, setAgreedToSecurity] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const sigCanvas = React.useRef<any>(null);
    const router = useRouter();

    React.useEffect(() => {
        // Preview 모드에서는 체크하지 않음
        if (preview) return;

        const checkStatus = async () => {
            try {
                const res = await fetch("/api/security-pledge");
                if (res.ok) {
                    const data = await res.json();
                    if (data.hasSigned) {
                        // 이미 서약서 작성한 경우 리다이렉트하거나 onComplete 호출
                        if (onComplete) {
                            onComplete();
                        } else {
                            router.replace(redirectTo);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to check pledge status:", error);
            }
        };
        checkStatus();
    }, [router, preview, onComplete, redirectTo]);

    const clearSignature = () => {
        sigCanvas.current?.clear();
    };

    const handleSubmit = async () => {
        // Preview 모드에서는 제출 불가
        if (preview) {
            alert("미리보기 모드에서는 제출할 수 없습니다.");
            return;
        }

        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            alert("서명을 해주세요.");
            return;
        }

        setIsSubmitting(true);
        try {
            const signatureData = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");

            const response = await fetch("/api/security-pledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signatureData }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to submit pledge");
            }

            alert("보안 서약서가 제출되었습니다.");

            // onComplete 콜백이 있으면 호출, 없으면 리다이렉트
            if (onComplete) {
                onComplete();
            } else {
                router.push(redirectTo);
            }
        } catch (error) {
            console.error("Submission error:", error);
            alert("제출 중 오류가 발생했습니다. 다시 시도해주세요.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const canSubmit = agreedToPrivacy && agreedToSecurity;

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
            <Card className="w-full max-w-2xl shadow-lg">
                <CardHeader className="text-center border-b bg-white rounded-t-xl pb-6">
                    <CardTitle className="text-2xl font-bold text-gray-900">
                        보안 서약서 및 개인정보 수집 동의{preview && " (미리보기)"}
                    </CardTitle>
                    <CardDescription className="mt-2 text-gray-600">
                        {preview
                            ? "임시점검원 가입 시 동의하게 될 보안 서약서 내용입니다."
                            : "임시점검원 업무 수행을 위해 아래 내용을 확인하고 동의해 주십시오."}
                    </CardDescription>
                    {preview && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-700">
                                ℹ️ 이것은 미리보기 페이지입니다. 실제 서약서는 회원가입 과정에서 작성하게 됩니다.
                            </p>
                        </div>
                    )}
                </CardHeader>

                <CardContent className="space-y-8 p-6">
                    {/* Section 1: Personal Information Collection */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                1. 개인정보 수집 및 이용 동의
                                <span className="text-xs font-normal text-red-500 border border-red-200 bg-red-50 px-2 py-0.5 rounded-full">필수</span>
                            </h3>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm text-gray-600 leading-relaxed">
                            <p>
                                본인은 임시점검원으로서 업무를 수행함에 있어, 다음과 같이 개인정보를 수집·이용하는 것에 동의합니다.
                            </p>
                            <ul className="list-disc list-inside mt-2 space-y-1 ml-1">
                                <li><strong>수집 목적:</strong> 임시점검원 신원 확인, 업무 배정 및 관리, 보안 서약 효력 유지</li>
                                <li><strong>수집 항목:</strong> 성명, 휴대전화번호, 생년월일, 소속(필요 시)</li>
                                <li><strong>보유 기간:</strong> <span className="underline decoration-gray-400 underline-offset-2">업무 종료 및 보안 책임 기간 만료 시까지 (최대 1년)</span></li>
                            </ul>
                            <p className="mt-2 text-xs text-gray-500">
                                ※ 귀하는 개인정보 수집·이용에 거부할 권리가 있으나, 동의 거부 시 임시점검원 업무 수행이 불가능할 수 있습니다.
                            </p>
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                            <Checkbox
                                id="privacy-agreement"
                                checked={agreedToPrivacy}
                                onCheckedChange={(checked) => !preview && setAgreedToPrivacy(checked as boolean)}
                                disabled={preview}
                            />
                            <Label
                                htmlFor="privacy-agreement"
                                className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${preview ? 'opacity-60' : 'cursor-pointer'}`}
                            >
                                위 개인정보 수집 및 이용에 동의합니다.
                            </Label>
                        </div>
                    </section>

                    <div className="h-px bg-gray-100" />

                    {/* Section 2: Security Pledge */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                2. 보안 서약서
                                <span className="text-xs font-normal text-red-500 border border-red-200 bg-red-50 px-2 py-0.5 rounded-full">필수</span>
                            </h3>
                        </div>
                        <ScrollArea className="h-[280px] w-full rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 leading-relaxed shadow-sm">
                            <p className="font-medium mb-2">
                                본인은 귀사의 임시점검원으로서 현장 점검 업무를 수행함에 있어, 다음 사항을 준수할 것을 엄숙히 서약합니다.
                            </p>

                            <ol className="list-decimal list-outside ml-5 space-y-3">
                                <li>
                                    <strong>목적 외 사용 금지:</strong> 본인은 업무 수행 중 취득한 모든 정보(관리책임자 성명, 연락처, 설치 장소의 세부 정보 등)를 오직 정해진 점검 업무 목적으로만 사용하겠습니다.
                                </li>
                                <li>
                                    <strong>제3자 제공 및 유출 금지:</strong> 본인은 업무상 알게 된 개인정보 및 기밀 사항을 타인에게 누설하거나, 인터넷/SNS 등에 게시하는 등 외부로 유출하지 않겠습니다.
                                </li>
                                <li>
                                    <strong>자료의 보호 및 파기:</strong> 본인은 점검 화면 캡처, 메모 등 업무상 생성된 자료를 철저히 관리하며, 업무가 종료되거나 목적이 달성된 즉시 복구 불가능한 방법으로 파기하겠습니다.
                                </li>
                                <li>
                                    <strong>접근 권한 준수:</strong> 본인은 부여받은 권한(본인 할당 장비 조회 및 본인 점검 결과 수정)을 넘어서는 시스템 접근이나 정보 열람을 시도하지 않겠습니다.
                                </li>
                                <li>
                                    <strong>법적 책임:</strong> 만약 위 사항을 위반하여 개인정보 유출 사고나 보안 사고가 발생할 경우, 관련 법령(개인정보보호법 등)에 따른 민·형사상 책임을 질 것을 서약합니다.
                                </li>
                            </ol>

                            <div className="mt-6 pt-4 border-t border-dashed border-gray-200 text-center">
                                <p className="text-gray-500 text-xs mb-1">{new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일</p>
                                <p className="font-bold text-gray-800">서약자: {session?.user?.name || session?.user?.email || '사용자'}</p>
                            </div>
                        </ScrollArea>

                        <div className="flex items-center space-x-2 pt-1">
                            <Checkbox
                                id="security-agreement"
                                checked={agreedToSecurity}
                                onCheckedChange={(checked) => !preview && setAgreedToSecurity(checked as boolean)}
                                disabled={preview}
                            />
                            <Label
                                htmlFor="security-agreement"
                                className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${preview ? 'opacity-60' : 'cursor-pointer'}`}
                            >
                                위 보안 서약 내용을 충분히 숙지하였으며, 이에 동의합니다.
                            </Label>
                        </div>
                    </section>

                    <div className="h-px bg-gray-100" />

                    {/* Section 3: Electronic Signature */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                3. 전자 서명
                                <span className="text-xs font-normal text-red-500 border border-red-200 bg-red-50 px-2 py-0.5 rounded-full">필수</span>
                            </h3>
                        </div>
                        {preview ? (
                            <div className="border border-gray-200 rounded-lg bg-gray-50 p-8 text-center">
                                <p className="text-gray-500">
                                    실제 가입 시 이 영역에서 전자서명을 하게 됩니다.
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                    터치스크린 또는 마우스로 서명할 수 있습니다.
                                </p>
                            </div>
                        ) : (
                            <div className="border border-gray-300 rounded-lg bg-white overflow-hidden relative">
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    penColor="black"
                                    canvasProps={{
                                        className: "w-full h-40 bg-white cursor-crosshair"
                                    }}
                                />
                                <div className="absolute top-2 right-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={clearSignature}
                                        className="text-xs h-7 px-2"
                                    >
                                        지우기
                                    </Button>
                                </div>
                                <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                                    <span className="text-gray-300 text-sm">여기에 서명해주세요</span>
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-gray-500">
                            ※ 위 서명은 본인의 자필 서명과 동일한 효력을 가집니다.
                        </p>
                    </section>

                </CardContent>

                <CardFooter className="flex flex-col gap-3 bg-gray-50 rounded-b-xl p-6 border-t">
                    {preview ? (
                        <>
                            <Button
                                className="w-full text-base py-6 font-semibold shadow-md transition-all hover:shadow-lg"
                                size="lg"
                                onClick={() => router.push('/auth/signup')}
                                variant="outline"
                            >
                                회원가입하러 가기
                            </Button>
                            <Button
                                className="w-full text-base py-6 font-semibold shadow-md transition-all hover:shadow-lg"
                                size="lg"
                                onClick={() => router.push('/')}
                            >
                                홈으로 돌아가기
                            </Button>
                            <p className="text-xs text-center text-gray-400">
                                이 내용은 임시점검원 가입 과정에서 실제로 동의하게 됩니다.
                            </p>
                        </>
                    ) : (
                        <>
                            <Button
                                className="w-full text-base py-6 font-semibold shadow-md transition-all hover:shadow-lg"
                                size="lg"
                                disabled={!canSubmit || isSubmitting}
                                onClick={handleSubmit}
                            >
                                {isSubmitting ? "제출 중..." : "동의하고 계속하기"}
                            </Button>
                            <p className="text-xs text-center text-gray-400">
                                모든 필수 항목에 동의하고 서명을 완료해야 합니다.
                            </p>
                        </>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
