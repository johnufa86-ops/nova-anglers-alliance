import { db } from '@/lib/db';
import Link from 'next/link';

export const revalidate = 60; // кэш на 60 секунд

async function getCompetitions() {
  try {
    return await (db as any).competition.findMany({
      where: { status: 'upcoming' },
      orderBy: { date: 'asc' },
      take: 6,
    });
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const competitions = await getCompetitions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-lg bg-white/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md">
                🎣
              </div>
              <div>
                <div className="font-bold text-slate-900 text-lg leading-tight">Nova Anglers</div>
                <div className="text-xs text-slate-500 leading-tight">Alliance</div>
              </div>
            </Link>

            <nav className="flex items-center gap-2">
              <Link
                href="/rating.html"
                className="px-4 py-2 text-slate-700 hover:text-blue-600 font-medium text-sm transition"
              >
                Рейтинг
              </Link>
              <Link
                href="/cabinet-applications.html"
                className="px-4 py-2 text-slate-700 hover:text-blue-600 font-medium text-sm transition"
              >
                Мои заявки
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-sm transition shadow-sm"
              >
                Войти
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Сезон 2026 открыт
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 tracking-tight mb-6">
            Федерация рыболовного<br />
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              спорта
            </span>
          </h1>
          <p className="text-xl text-slate-600 mb-8 leading-relaxed">
            Официальная платформа Nova Anglers Alliance. Регистрация на турниры, 
            оплата по реквизитам, публичный рейтинг спортсменов.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/register"
              className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl font-semibold text-base shadow-lg shadow-blue-500/30 transition"
            >
              Стать участником
            </Link>
            <Link
              href="/rating.html"
              className="px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-xl font-semibold text-base transition shadow-sm"
            >
              Смотреть рейтинг
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Турниров', value: competitions.length || '1', icon: '🏆' },
            { label: 'Спортсменов', value: '3', icon: '👥' },
            { label: 'Дисциплин', value: '3', icon: '🎯' },
            { label: 'Сезон', value: '2026', icon: '📅' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming competitions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Предстоящие турниры</h2>
            <p className="text-slate-500 mt-2">Открыта регистрация на соревнования сезона</p>
          </div>
        </div>

        {competitions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <p className="text-slate-500">Нет активных турниров</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitions.map((comp: any) => (
              <article
                key={comp.id}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-blue-300 transition-all duration-300"
              >
                <div className="aspect-[16/10] bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-90">
                    🎣
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1 bg-white/95 backdrop-blur rounded-full text-xs font-semibold text-slate-900 shadow-sm">
                      {comp.discipline === 'spinning' && '🎯 Спиннинг'}
                      {comp.discipline === 'feeder' && '🪝 Фидер'}
                      {comp.discipline === 'carp' && '🐟 Карп'}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-blue-600 transition">
                    {comp.title}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4 min-h-[2.5rem]">
                    {comp.description || 'Официальный турнир федерации'}
                  </p>

                  <div className="space-y-2 mb-5 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span>📅</span>
                      <span>
                        {new Date(comp.date).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <span>📍</span>
                      <span className="truncate">{comp.location}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div>
                      <div className="text-xs text-slate-500">Взнос</div>
                      <div className="font-bold text-slate-900">{comp.fee} ₽</div>
                    </div>
                    <Link
                      href="/cabinet-applications.html"
                      className="px-5 py-2.5 bg-slate-900 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition"
                    >
                      Участвовать →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
          Возможности платформы
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: '🏆',
              title: 'Официальные турниры',
              description: 'Регистрация на соревнования с автоматическим подтверждением',
            },
            {
              icon: '💳',
              title: 'Удобная оплата',
              description: 'Оплата по реквизитам с загрузкой чека и модерацией',
            },
            {
              icon: '📊',
              title: 'Публичный рейтинг',
              description: 'Прозрачная система начисления баллов и медалей',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-8 border border-slate-200 hover:border-blue-300 transition"
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">{f.title}</h3>
              <p className="text-slate-600">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                  🎣
                </div>
                <div className="font-bold text-white text-lg">Nova Anglers Alliance</div>
              </div>
              <p className="text-sm text-slate-400 max-w-md">
                Официальная федерация рыболовного спорта. Организация турниров, 
                ведение рейтинга и развитие спортивного рыболовства.
              </p>
            </div>

            <div>
              <div className="font-semibold text-white mb-4">Платформа</div>
              <div className="space-y-2 text-sm">
                <Link href="/rating.html" className="block hover:text-white transition">
                  Рейтинг
                </Link>
                <Link href="/cabinet-applications.html" className="block hover:text-white transition">
                  Личный кабинет
                </Link>
                <Link href="/register" className="block hover:text-white transition">
                  Регистрация
                </Link>
              </div>
            </div>

            <div>
              <div className="font-semibold text-white mb-4">Контакты</div>
              <div className="space-y-2 text-sm text-slate-400">
                <div>support@nova-anglers.ru</div>
                <div>+7 (XXX) XXX-XX-XX</div>
              </div>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-slate-800 text-sm text-slate-500 text-center">
            © 2026 Nova Anglers Alliance. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
}