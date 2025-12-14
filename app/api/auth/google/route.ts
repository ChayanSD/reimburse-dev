import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth } from '@/lib/firebase-admin';
import prisma from '@/lib/prisma';
import { createSession, setSessionCookie } from '@/lib/session';

export async function POST(req: NextRequest) : Promise<NextResponse> {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const { uid: googleId, email, name } = decodedToken;

    if (!email) {
      return NextResponse.json({ error: 'Email is required from Google' }, { status: 400 });
    }

    // Check if user exists with this Google ID
    let user = await prisma.authUser.findUnique({
      where: { googleId },
    });

    if (!user) {
      // Check if user exists with this email (for linking)
      const existingUser = await prisma.authUser.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Link Google ID to existing user
        user = await prisma.authUser.update({
          where: { id: existingUser.id },
          data: { googleId },
        });
      } else {
        // Create new user
        const [firstName, ...lastNameParts] = (name || '').split(' ');
        const lastName = lastNameParts.join(' ');

        user = await prisma.authUser.create({
          data: {
            email,
            firstName: firstName || null,
            lastName: lastName || null,
            googleId,
            password: '',
            role: 'USER',
          },
        });
      }
    }

    // Create session
    const sessionId = await createSession({
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

    // Set session cookie
    await setSessionCookie(sessionId);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}