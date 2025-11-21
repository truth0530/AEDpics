import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const pledgeSchema = z.object({
    signatureData: z.string().min(1, "서명이 필요합니다."),
    pledgeType: z.string().default("temporary_inspector_pledge"),
});

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const pledge = await prisma.security_pledges.findFirst({
            where: {
                user_id: session.user.id,
                pledge_type: "temporary_inspector_pledge",
            },
        });

        return NextResponse.json({
            hasSigned: !!pledge,
            signedAt: pledge?.agreed_at || null,
        });
    } catch (error) {
        console.error("[SecurityPledge] GET Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validation = pledgeSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid data", details: validation.error.issues },
                { status: 400 }
            );
        }

        const { signatureData, pledgeType } = validation.data;

        // Check if already signed
        const existingPledge = await prisma.security_pledges.findFirst({
            where: {
                user_id: session.user.id,
                pledge_type: pledgeType,
            },
        });

        if (existingPledge) {
            return NextResponse.json(
                { error: "Already signed" },
                { status: 409 }
            );
        }

        // Save pledge
        const pledge = await prisma.security_pledges.create({
            data: {
                user_id: session.user.id,
                pledge_type: pledgeType,
                signature_data: signatureData,
                ip_address: req.headers.get("x-forwarded-for") ?? "127.0.0.1",
                user_agent: req.headers.get("user-agent"),
            },
        });

        return NextResponse.json({ success: true, pledgeId: pledge.id });
    } catch (error) {
        console.error("[SecurityPledge] POST Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
