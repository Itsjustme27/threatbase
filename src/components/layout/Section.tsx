import { cn } from '@/lib/utils'
import Container from './Container'

type Spacing = 'sm' | 'md' | 'lg'
type ContainerWidth = 'narrow' | 'docs' | 'wide'

const SPACING: Record<Spacing, string> = {
  sm: 'py-12 md:py-16',
  md: 'py-16 md:py-24',
  lg: 'py-20 md:py-28',
}

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  spacing?: Spacing
  /** Width of the inner Container. Pass `false` to render children without a Container. */
  container?: ContainerWidth | false
  containerClassName?: string
}

/**
 * Vertical rhythm wrapper for a page section. Sections with an `id` get scroll-margin
 * so anchored navigation lands clear of the fixed navbar.
 */
export default function Section({
  spacing = 'lg',
  container = 'wide',
  containerClassName,
  className,
  id,
  children,
  ...props
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn('relative', SPACING[spacing], id && 'scroll-mt-24', className)}
      {...props}
    >
      {container === false ? children : <Container width={container} className={containerClassName}>{children}</Container>}
    </section>
  )
}
