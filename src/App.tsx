import { Route, Routes } from "react-router"
import HomePage from "./pages/Homepage"
import WritePage from "./pages/WritePage"

function App() {
  return (
    <main className="mx-auto min-h-screen w-[80%] border-1">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/write" element={<WritePage />} />
      </Routes>
    </main>
  )
}

export default App