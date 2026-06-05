import './style.css'
import App from './App'
import { render } from 'solid-js/web'

const root = document.getElementById('root')
if (!root) {
	throw new Error('root element not found')
}

render(() => <App />, root)
