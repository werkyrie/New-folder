import { NextResponse } from "next/server"

export async function GET() {
  // TODO: Replace with Firebase authentication and database calls
  return NextResponse.json({ error: "API temporarily disabled - migrating to Firebase" }, { status: 503 })
}

export async function POST(request: Request) {
  // TODO: Replace with Firebase authentication and database calls
  return NextResponse.json({ error: "API temporarily disabled - migrating to Firebase" }, { status: 503 })
}
