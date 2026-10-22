import { cn } from "@festhub/ui/lib/utils";
import React, { PropsWithChildren } from "react";

const MaxWidthWrapper: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...restProps
}) => {
  return (
    <div
      className={cn("max-w-380 w-full px-4 mx-auto", className)}
      {...restProps}
    >
      {children}
    </div>
  );
};

export default MaxWidthWrapper;
