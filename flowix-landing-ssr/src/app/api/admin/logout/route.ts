import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })
  
  // Удаляем cookies
  response.cookies.delete('admin_token')
  response.cookies.delete('admin_refresh_token')
  
  return response
}









