export function PlaceholderScreen({ title, builtIn }: { title: string; builtIn: string }) {
  return (
    <>
      <h1 tabIndex={-1}>{title}</h1>
      <p>Built in {builtIn}.</p>
    </>
  )
}
