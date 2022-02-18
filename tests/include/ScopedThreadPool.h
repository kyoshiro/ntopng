
/*
 *
 * (C) 2013-22 - ntop.org
 *
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307, USA.
 *
 */
#ifndef _TEST_SCOPED_THREAD_POOL_H_
#define _TEST_SCOPED_THREAD_POOL_H_

#include "ThreadedActivity.h"
#include "ThreadPool.h"
namespace ntoptesting {

class ScopedThreadPool {
public:
  ScopedThreadPool();
  void Shutdown();
  void Run();
  bool IsActive() const;
  ThreadPool *GetPool() const;
  ~ScopedThreadPool();
  void WaitFor(int seconds);

private:
  ThreadPool *pool_;
  pthread_t run_thread_;
  bool is_active_;
};
}
#endif