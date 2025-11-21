"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

const SignatureCanvas = dynamic(() => import("react-signature-canvas"), {
    ssr: false,
    loading: () => <div className="w-full h-40 bg-gray-800 animate-pulse rounded-lg" />,
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
    onComplete?: () => void;
    redirectTo?: string;
}

export function SecurityPledge({ onComplete, redirectTo = "/dashboard" }: SecurityPledgeProps) {
    const { data: session } = useSession();
    const [agreedToSecurity, setAgreedToSecurity] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const sigCanvas = React.useRef<any>(null);
    const router = useRouter();

    React.useEffect(() => {
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
    }, [router, onComplete, redirectTo]);

    const clearSignature = () => {
        sigCanvas.current?.clear();
    };

    const handleSubmit = async () => {
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

    const canSubmit = agreedToSecurity;

    // 보건소명 가져오기 (session에서 조직명 사용)
    const organizationName = session?.user?.organizationName || "[소속기관명]";

    // 현재 날짜
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();

    // 사용자 이름
    const userName = session?.user?.name || "[사용자 이름]";

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-900 p-4">
            <Card className="w-full max-w-2xl shadow-2xl bg-gray-800 border-gray-700">
                <CardHeader className="text-center border-b border-gray-700 bg-gray-800 rounded-t-xl pb-6">
                    <CardTitle className="text-2xl font-bold text-white">
                        보안 서약서
                    </CardTitle>
                    <CardDescription className="mt-2 text-gray-400">
                        임시점검원 업무 수행을 위해 아래 내용을 확인하고 동의해 주십시오.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-8 p-6">
                    {/* Security Pledge Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                보안 서약 내용
                                <span className="text-xs font-normal text-red-400 border border-red-800 bg-red-950 px-2 py-0.5 rounded-full">필수</span>
                            </h3>
                        </div>
                        <ScrollArea className="h-[320px] w-full rounded-lg border border-gray-700 bg-gray-900 p-4 text-sm text-gray-300 leading-relaxed shadow-inner">
                            <p className="font-medium mb-2 text-white">
                                본인은 {organizationName}의 임시점검원으로서 현장 점검 업무를 수행함에 있어, 다음 사항을 준수할 것을 엄숙히 서약합니다.
                            </p>

                            <ol className="list-decimal list-outside ml-5 space-y-3">
                                <li>
                                    <strong className="text-yellow-400">목적 외 사용 금지:</strong> 본인은 업무 수행 중 취득한 모든 정보(관리책임자 성명, 연락처, 설치 장소의 세부 정보 등)를 오직 정해진 점검 업무 목적으로만 사용하겠습니다.
                                </li>
                                <li>
                                    <strong className="text-yellow-400">제3자 제공 및 유출 금지:</strong> 본인은 업무상 알게 된 개인정보 및 기밀 사항을 타인에게 누설하거나, 인터넷/SNS 등에 게시하는 등 외부로 유출하지 않겠습니다.
                                </li>
                                <li>
                                    <strong className="text-yellow-400">자료의 보호 및 파기:</strong> 본인은 점검 화면 캡처, 메모 등 업무상 생성된 자료를 철저히 관리하며, 업무가 종료되거나 목적이 달성된 즉시 복구 불가능한 방법으로 파기하겠습니다.
                                </li>
                                <li>
                                    <strong className="text-yellow-400">접근 권한 준수:</strong> 본인은 부여받은 권한(본인 할당 장비 조회 및 본인 점검 결과 수정)에 충실할 것이며 아이디와 비밀번호를 타인과 공유하지 않겠습니다.
                                </li>
                                <li>
                                    <strong className="text-yellow-400">법적 책임:</strong> 만약 위 사항을 위반하여 개인정보 유출 사고나 보안 사고가 발생할 경우, 관련 법령(개인정보보호법 등)에 따른 민·형사상 책임을 질 것을 서약합니다.
                                </li>
                            </ol>

                            <div className="mt-6 pt-4 border-t border-dashed border-gray-700 text-center">
                                <p className="text-gray-400 text-xs mb-1">{year}년 {month}월 {day}일</p>
                                <p className="font-bold text-white">서약자: {userName}</p>
                            </div>
                        </ScrollArea>

                        <div className="flex items-center space-x-2 pt-1">
                            <Checkbox
                                id="security-agreement"
                                checked={agreedToSecurity}
                                onCheckedChange={(checked) => setAgreedToSecurity(checked as boolean)}
                                className="border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <Label
                                htmlFor="security-agreement"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-gray-300"
                            >
                                위 보안 서약 내용을 충분히 숙지하였으며, 이에 동의합니다.
                            </Label>
                        </div>
                    </section>

                    <div className="h-px bg-gray-700" />

                    {/* Electronic Signature Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                전자 서명
                                <span className="text-xs font-normal text-red-400 border border-red-800 bg-red-950 px-2 py-0.5 rounded-full">필수</span>
                            </h3>
                        </div>
                        <div className="border border-gray-700 rounded-lg bg-gray-950 overflow-hidden relative">
                            <SignatureCanvas
                                ref={sigCanvas}
                                penColor="white"
                                canvasProps={{
                                    className: "w-full h-40 bg-gray-950 cursor-crosshair"
                                }}
                            />
                            <div className="absolute top-2 right-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearSignature}
                                    className="text-xs h-7 px-2 bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                                >
                                    지우기
                                </Button>
                            </div>
                            <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                                <span className="text-gray-600 text-sm">여기에 서명해주세요</span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400">
                            ※ 위 서명은 본인의 자필 서명과 동일한 효력을 가집니다.
                        </p>
                    </section>

                </CardContent>

                <CardFooter className="flex flex-col gap-3 bg-gray-800 rounded-b-xl p-6 border-t border-gray-700">
                    <Button
                        className="w-full text-base py-6 font-semibold shadow-md transition-all hover:shadow-lg bg-blue-600 hover:bg-blue-700 text-white"
                        size="lg"
                        disabled={!canSubmit || isSubmitting}
                        onClick={handleSubmit}
                    >
                        {isSubmitting ? "제출 중..." : "동의하고 계속하기"}
                    </Button>
                    <p className="text-xs text-center text-gray-500">
                        보안 서약에 동의하고 서명을 완료해야 합니다.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
