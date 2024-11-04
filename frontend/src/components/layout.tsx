import { MyNavbar } from "./ui/myNavbar"
 
import { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <MyNavbar />
      <main>{children}</main>
    </>
  )
}