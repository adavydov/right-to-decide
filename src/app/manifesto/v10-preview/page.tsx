import {notFound} from "next/navigation";
import data from "@/data/manifesto-v10.json";
import {ManifestoV10, type Manifesto} from "@/components/ManifestoV10";
export const metadata={title:"Локальный просмотр манифеста",robots:{index:false,follow:false}};
export default function Preview(){if(process.env.V10_PUBLIC_PREVIEW!=="1"||!data.blocks.length)notFound();return <ManifestoV10 data={data as Manifesto} preview/>;}
