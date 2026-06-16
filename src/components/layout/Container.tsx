import { cn } from '@/lib/utils'

type ContainerWidth = 'narrow' | 'docs' | 'wide'

const WIDTHS: Record<ContainerWidth, string> = {
  narrow: 'max-w-2xl',
  docs: 'max-w-4xl',
  wide: 'max-w-7xl',
}

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: ContainerWidth
}

/** Horizontal layout wrapper: centered, width-capped, with consistent responsive gutters. */
export default function Container({ width = 'wide', className, children, ...props }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-6 lg:px-12', WIDTHS[width], className)} {...props}>
      {children}
    </div>
  )
}
