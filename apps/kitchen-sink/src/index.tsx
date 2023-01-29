// import '@tamagui/core/reset.css'
// import '@tamagui/polyfill-dev'

// import { config as configBase } from '@tamagui/config-base'
// import React from 'react'
// import { createRoot } from 'react-dom/client'
// import { Button, TamaguiProvider, createTamagui } from 'tamagui'

// globalThis['React'] = React

// const config = createTamagui({
//   ...configBase,
//   themeClassNameOnRoot: false,
// })

// export type Conf = typeof config

// declare module 'tamagui' {
//   interface TamaguiCustomConfig extends Conf {}
// }

// const App = () => {
//   return (
//     <TamaguiProvider config={config} defaultTheme="light">
//       <Button>hi</Button>
//     </TamaguiProvider>
//   )
// }

// createRoot(document.querySelector('#root')!).render(<App />)

// import 'vite/modulepreload-polyfill'

import { registerRootComponent } from 'expo'
import React from 'react'
import { View } from 'react-native'

// import App from './App'

globalThis['React'] = React

registerRootComponent(Root)

function Root() {
  return <View style={{ backgroundColor: 'red', width: 100, height: 100 }} />
}
