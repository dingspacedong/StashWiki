import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { fontFaceCss } from '@shared/defaults'
import { STORY_CSS } from './lib/storyStyles'

// The Google fonts ship with the app (in fonts/ next to index.html); the browser only loads the ones in use.
const fonts = document.createElement('style')
fonts.textContent = fontFaceCss('fonts/')
document.head.appendChild(fonts)

// Story pages share their look with the exported website.
const storyStyle = document.createElement('style')
storyStyle.textContent = STORY_CSS
document.head.appendChild(storyStyle)

createRoot(document.getElementById('root')!).render(<App />)
