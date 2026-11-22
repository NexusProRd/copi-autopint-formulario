import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Cuestionario de requisitos | Copi Autopint · NexusRD',description:'Formulario de levantamiento de requisitos de Copi Autopint, preparado por NexusRD.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
