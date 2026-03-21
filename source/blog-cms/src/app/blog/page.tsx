import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getAllPosts } from '@/lib/blog'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Latest posts and updates.',
}

export default async function BlogPage() {
  const posts = await getAllPosts()
  const [featured, ...rest] = posts

  return (
    <main className="bg-gray-50">
      {/* Hero */}
      <section className="pt-36 pb-12 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-5">Blog</p>
          <h1 className="text-6xl md:text-8xl font-light text-gray-900 leading-[0.9] mb-6">
            Latest Posts
          </h1>
          <p className="text-lg text-gray-600 max-w-xl leading-relaxed">
            Updates, guides, and insights from the team.
          </p>
        </div>
      </section>

      {posts.length === 0 ? (
        <section className="py-32 bg-gray-50">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <p className="text-gray-600 text-lg">No posts yet. Check back soon.</p>
          </div>
        </section>
      ) : (
        <>
          {/* Featured Post */}
          {featured && (
            <section className="pt-12 pb-16 bg-white border-t border-gray-100">
              <div className="max-w-6xl mx-auto px-6">
                <Link href={`/blog/${featured.slug}`} className="group block">
                  <div className="grid md:grid-cols-2 gap-12 items-center">
                    {featured.image && (
                      <div className="aspect-[4/3] overflow-hidden rounded-xl">
                        <Image
                          src={featured.image}
                          alt={featured.title}
                          width={800}
                          height={600}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          quality={95}
                        />
                      </div>
                    )}
                    <div className={featured.image ? '' : 'md:col-span-2'}>
                      {featured.tags && featured.tags.length > 0 && (
                        <div className="flex flex-wrap gap-4 mb-5">
                          {featured.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-xs uppercase tracking-widest text-gray-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <h2 className="font-light text-4xl md:text-5xl text-gray-900 leading-tight mb-5 group-hover:text-gray-600 transition-colors duration-300">
                        {featured.title}
                      </h2>
                      <p className="text-lg text-gray-600 leading-relaxed mb-7">
                        {featured.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <time dateTime={featured.date}>
                          {new Date(featured.date).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </time>
                        <span>&middot;</span>
                        <span>{featured.readingTime}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </section>
          )}

          {/* Remaining Posts */}
          {rest.length > 0 && (
            <section className="py-16 bg-gray-50">
              <div className="max-w-6xl mx-auto px-6">
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-10 pt-2 border-t border-gray-200">
                  More Posts
                </p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
                  {rest.map((post) => (
                    <article key={post.slug}>
                      <Link href={`/blog/${post.slug}`} className="group block">
                        {post.image && (
                          <div className="aspect-[3/2] overflow-hidden rounded-lg mb-5">
                            <Image
                              src={post.image}
                              alt={post.title}
                              width={600}
                              height={400}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            />
                          </div>
                        )}
                        {post.tags && post.tags.length > 0 && (
                          <span className="text-xs uppercase tracking-widest text-gray-500 block mb-2">
                            {post.tags[0]}
                          </span>
                        )}
                        <h3 className="font-light text-2xl text-gray-900 leading-snug mb-3 group-hover:text-gray-600 transition-colors duration-300">
                          {post.title}
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-2">
                          {post.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <time dateTime={post.date}>
                            {new Date(post.date).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </time>
                          <span>&middot;</span>
                          <span>{post.readingTime}</span>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
