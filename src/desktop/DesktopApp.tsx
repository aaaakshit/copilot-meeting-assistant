import { useDesktopPresenter } from './presenter/useDesktopPresenter'
import { DesktopView } from './view/DesktopView'
import './view/desktop.css'

export function DesktopApp() {
  return <DesktopView {...useDesktopPresenter()} />
}
