"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

/** The filing snackbar: dark, bottom-center, quiet. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      duration={6000}
      offset={28}
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 rounded-full bg-foreground py-3 pr-4 pl-5 text-[15px] text-background shadow-[0_8px_24px_rgb(0_0_0/0.18)] w-max max-w-[calc(100vw-2rem)]",
          title: "font-medium",
          icon: "text-[#7bd49a]",
          actionButton:
            "ml-2 rounded-full px-3 py-1 font-semibold text-background/80 hover:text-background hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
