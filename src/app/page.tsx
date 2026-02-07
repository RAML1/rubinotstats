export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          RubinOT Stats
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Character tracking coming soon
        </p>
        <div className="mt-8 text-sm text-muted-foreground">
          <p>Track your favorite characters, view auction data, and explore the market.</p>
        </div>
      </div>
    </div>
  );
}
