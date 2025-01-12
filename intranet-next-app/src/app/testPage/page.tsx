"use client";
import withAuth from '@/hoc/withAuth';


function TestPage() {
  return (
    <div>
        <h1>
        This is a sheares web authentication test page
        This is not supposed to be able to be accessed if not logged in.
        </h1>
    </div>
  )
}

export default withAuth(TestPage);
