import { CatalogService } from '@/lib/server/services/catalogService';
import Link from 'next/link';

export default async function ProgramBrowsePage({ params }: { params: { program: string } }) {
  const hierarchy = await CatalogService.getProgramWithHierarchy(params.program);

  if (!hierarchy) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h1 className="text-2xl font-bold text-gray-700">Program not found</h1>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{hierarchy.name} Preparation</h1>
          <p className="text-lg text-gray-600">Select a semester or subject to begin practicing</p>
        </header>

        <div className="space-y-12">
          {/* Display Semesters */}
          {hierarchy.semesters.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">By Semester</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {hierarchy.semesters.map((ps) => (
                  <Link 
                    key={ps.semesterId} 
                    href={`/browse/${params.program}/semester/${ps.semester.id}`}
                    className="block group"
                  >
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all duration-300 ease-in-out group-hover:shadow-md group-hover:border-blue-200 group-hover:-translate-y-1">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {ps.semester.label}
                      </h3>
                      <p className="text-gray-500 mt-2 text-sm">View subjects & topics &rarr;</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Display Subjects directly */}
          {hierarchy.subjects.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">All Subjects</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {hierarchy.subjects.map((ps) => (
                  <Link 
                    key={ps.subjectId} 
                    href={`/browse/${params.program}/subject/${ps.subject.slug}`}
                    className="block group"
                  >
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all duration-300 ease-in-out group-hover:shadow-md group-hover:border-indigo-200 group-hover:-translate-y-1">
                      <h3 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {ps.subject.name}
                      </h3>
                      <p className="text-gray-500 mt-2 text-sm">
                        {ps.subject.topics?.length || 0} Topics available
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
